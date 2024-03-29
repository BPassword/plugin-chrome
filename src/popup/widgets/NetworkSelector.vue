<template>
  <div class="networks-wrapper">
    <v-menu content-class="network-pop-menu" offset-y right>
      <template v-slot:activator="{ attrs, on }">
        <v-chip v-bind="attrs" v-on="on" small filter pill class="network-chiper">
          <v-icon size="8" :color="currentNetwork.color"> mdi-checkbox-blank-circle </v-icon>
          <span class="ms-2 pe-4">{{ currentNetwork.type }}</span>
        </v-chip>
      </template>
      <v-list item-height="16" v-for="(nw, idx) in networks" :key="idx" class="py-0">
        <v-list-item dense @click="networkChanged(nw.chainId)" class="network-item py-0 my-0">
          <v-list-item-content>
            <div>
              <v-icon size="14" :color="nw.color"> mdi-checkbox-blank-circle </v-icon>
              <span class="ms-1">{{ nw.nickname }}</span>
            </div>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>

<script>
import { mapGetters, mapState } from 'vuex';
import WhispererController from '@lib/messages/whisperer-controller';
import { API_RT_CHANGED_NETWORK } from '@lib/msgapi/api-types';
export default {
  name: 'NetworkSelector',
  computed: {
    ...mapGetters('ui', ['p3Dense']),
    ...mapGetters('web3', ['networks', 'chainId', 'currentNetwork']),
  },
  data() {
    return {};
  },
  methods: {
    async networkChanged(chainId) {
      const nws = await this.$store.state.web3.networks;
      const network = nws.find((n) => parseInt(n.chainId) === parseInt(chainId));
      if (!network) {
        console.error('no network matched.', chainId);
        return;
      }
      const whisperer = new WhispererController();
      whisperer
        .sendSimpleMessage(API_RT_CHANGED_NETWORK, network)
        .then(async (respState = {}) => {
          const {
            NetworkController = {},
            Web3Controller = {},
            WebsiteController = {},
            MobileController = {},
          } = respState;
          await this.$store.dispatch('web3/subInitNetworkState', NetworkController);
          await this.$store.dispatch('web3/subInitWeb3State', Web3Controller);
          await this.$store.dispatch('passbook/reloadWebsiteController', WebsiteController);
          await this.$store.dispatch('passbook/reloadMobileController', MobileController);
          this.$toast(`Changed Network ${network.type}`, 'success', 2700);
        })
        .catch((err) => {
          console.warn(err);
          this.$toast(`Changed Fail. ${err.message}`, 'fail', 8000);
        });
    },
  },
  mounted() {},
};
</script>
<style>
.networks-wrapper {
  height: 100%;
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  flex: 1 1 auto;
  align-items: center;
}

.network-chiper {
  font-size: 14px;
  border-radius: 10px;
  background-color: rgba(243, 244, 246, 1);
  border: 2px solid #c8cccf;
  padding: auto 24px;
}

.network-item > div.v-list-item__content {
  display: flex;
  flex-direction: row;
  font-size: 14px;
}

.network-item > div.v-list-item__content > div {
  display: flex;
}
</style>
