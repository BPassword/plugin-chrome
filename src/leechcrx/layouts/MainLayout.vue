<template>
  <v-main class="leech-main-border">
    <v-container id="LeeMainContent" class="py-0">
      <locked-component v-if="!isUnlocked" />
      <v-row justify="center" v-if="isUnlocked">
        <transition name="fade-transform" mode="out-in">
          <keep-alive>
            <router-view />
          </keep-alive>
        </transition>
        <v-btn
          color="bpgray"
          v-if="showColse"
          absolute
          top
          left
          icon
          small
          @click.stop="closeSelfHandle"
          style="top: 0px; left: 0px"
        >
          <v-icon dense>mdi-close</v-icon>
        </v-btn>
      </v-row>

      <v-footer absolute class="layout-footer px-0 py-0">
        <div class="text-center py-2" v-if="!isUnlocked">
          <div class="command-key-tips">
            {{
              getCommandType === 'mac' ? '解锁快捷键 Command+Shift+9' : '解锁快捷键 Control+Shift+9'
            }}
          </div>
        </div>

        <div class="px-2 py-2" v-if="isUnlocked">
          <bpass-icon />
          <v-spacer></v-spacer>
          <v-btn
            v-if="false"
            text
            color="bpgray"
            @click="openPopappPage"
            x-small
            v-ripple="{ class: 'primary--text' }"
            class="btn-footerbar"
          >
            {{ $t('l.managementPass') }}
          </v-btn>
          <div v-if="true">
            <span class="splitor" v-if="false">|</span>
            <v-btn
              text
              color="bpgray"
              @click="addOrCloseBtnHandle"
              x-small
              v-ripple="{ class: 'primary--text' }"
              class="btn-footerbar ps-0 pe-1"
            >
              <!-- {{ (isAddor ||filterItems.length ===0) ? $t('btn.close') : $t('btn.add') }} -->
              {{ $t('btn.close') }}
            </v-btn>
          </div>
        </div>
      </v-footer>
    </v-container>
  </v-main>
</template>

<script>
import { mapGetters } from 'vuex';

import BpassIcon from '../widgets/BPassIcon';
import LockedComponent from './components/LockedComponent';

import { API_WIN_SELECTOR_ERASER_FORCE, API_WIN_SELECTOR_UP_HEIGHT } from '@lib/msgapi/api-types';
import CheckRuntime from '@lib/helpers/check-runtime';
import { IFR_CONF } from '@lib/controllers/size-calculator';
const appRuntime = new CheckRuntime();

export default {
  name: 'MainLayout',
  components: {
    LockedComponent,
    BpassIcon,
  },
  computed: {
    ...mapGetters(['showColse', 'isAddor', 'isUnlocked', 'filterItems']),
    getCommandType() {
      const detectName = appRuntime.detectOS();
      return detectName.includes('Mac') ? 'mac' : 'window';
    },
  },
  data() {
    return {};
  },
  methods: {
    addOrCloseBtnHandle() {
      this.removeSelector();
      // if (this.isAddor || this.filterItems.length ===0) {
      //   this.removeSelector();
      // } else {
      //   this.gotoAddItemHandle();
      // }
    },
    closeBtnHandle() {
      let message = {
        apiType: API_WIN_SELECTOR_ERASER_FORCE,
        data: {
          isInner: window.top !== window.self,
        },
      };

      window.top.postMessage(message, '*');
    },
    removeSelector() {
      let message = {
        apiType: API_WIN_SELECTOR_ERASER_FORCE,
        data: {
          isInner: window.top !== window.self,
        },
      };

      window.top.postMessage(message, '*');
    },
    gotoAddItemHandle() {
      const message = {
        apiType: API_WIN_SELECTOR_UP_HEIGHT,
        data: {
          page: 'addPassPage',
          isAddor: true,
          ifrHeight: IFR_CONF.addorHeight,
        },
      };
      window.top.postMessage(message, '*');

      this.$store.dispatch('updateViewPath', 'addor');
      this.$router.push({ path: '/add_passbook' });
    },
  },
};
</script>
<style lang="css" scope>
.leech-main-border {
  border-left: 0px solid rgba(218, 220, 224, 1);
  border-right: 0px solid rgba(218, 220, 224, 1);
  border-top: 1px solid rgba(218, 220, 224, 1);
  border-bottom: 0px solid rgba(218, 220, 224, 1);
  /* border-radius: 4px; */
}

footer.layout-footer > div {
  display: flex;
  width: 100%;
  flex-direction: row;
  justify-content: center;
  align-items: center;
}

.v-card__actions.v-card-top-border {
  border-top: 1px solid rgba(140, 144, 146, 0.15);
  padding: 4px auto 4px !important;
}

.btn-footerbar .v-btn-none {
  text-transform: none;
}

.btn-footerbar .v-btn:hover:before,
.btn-footerbar .v-btn:focus:before {
  background-color: rgba(69, 138, 249, 1);
}

.btn-footerbar .v-btn:hover,
.btn-footerbar .v-btn__content:hover {
  color: rgba(69, 138, 249, 1);
}

@-moz-document url-prefix() {
  .btn-footerbar.v-btn.v-size--x-small {
    font-size: 0.8rem;
  }
}
</style>
