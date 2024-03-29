<template>
  <v-container>
    <subnav-bar
      :gobackCall="gobackHandle"
      :hasDelete="true"
      :title="$t('p.passbook.editItemTitle')"
      @del-event="deleteItemHandle"
    />

    <v-row justify="center">
      <v-col cols="11">
        <div class="my-2 px-6 py-2 website-domain-wrap">
          <div class="edit-sheet-title">
            {{ $t('l.title') }}
          </div>
          <div class="domain-text">
            {{ transferItem.title }}
          </div>
        </div>
        <div class="error-tips">
          <div class="tips__content" v-show="Boolean(this.error)">
            {{ this.error }}
          </div>
        </div>
        <v-form ref="dataForm">
          <v-text-field
            v-model="transferItem.username"
            :value="transferItem.username"
            :placeholder="$t('l.usernamePlaceholder')"
            outlined
            rounded
            :loading="ctrl.loading"
            :rules="rules.required"
            dense
            color="bpgray"
          />
          <v-text-field
            v-model="transferItem.password"
            :value="transferItem.password"
            :placeholder="$t('l.passwordPlaceholder')"
            outlined
            rounded
            counter
            :loading="ctrl.loading"
            :rules="rules.required"
            :type="ctrl.pwdShow ? 'text' : 'password'"
            :append-icon="ctrl.pwdShow ? 'mdi-eye' : 'mdi-eye-off'"
            @click:append="ctrl.pwdShow = !ctrl.pwdShow"
            dense
            color="bpgray"
          />
          <v-btn
            @click="saveRequestHandle"
            block
            rounded
            :loading="ctrl.loading"
            color="primary"
            dark
          >
            {{ $t('btn.save') }}
          </v-btn>
        </v-form>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { mapGetters } from 'vuex';
import SubnavBar from '@/popup/widgets/SubnavBar.vue';
import { trimItemPorps } from '@/libs/utils/item-transfer';

import WhispererController from '@/libs/messages/whisperer-controller';
import { API_RT_EDIT_MOB_ITEM, API_RT_DELETE_MOB_ITEM } from '@/libs/msgapi/api-types';

export default {
  name: 'EditWebsiteItem',
  components: {
    SubnavBar,
  },
  computed: {
    ...mapGetters('ui', ['icons']),
    ...mapGetters('passbook', ['transferItem']),
  },
  data() {
    return {
      item: {
        title: '',
        hostname: '',
        username: '',
        password: '',
      },
      error: '',
      ctrl: {
        loading: false,
        pwdShow: false,
      },
      rules: {
        required: [(v) => (!!v && v.trim().length > 0) || 'required'],
      },
    };
  },
  methods: {
    resetForm() {
      this.$refs.dataForm.reset();
      this.ctrl.loading = false;
      this.error = '';
    },
    gobackHandle() {
      this.resetForm();
      this.$router.go(-1);
    },
    saveRequestHandle() {
      if (this.$refs.dataForm.validate()) {
        const data = this.transferItem;
        const whisperer = new WhispererController();

        this.ctrl.loading = true;
        whisperer
          .sendSimpleMessage(API_RT_EDIT_MOB_ITEM, data)
          .then(async (websiteState) => {
            await this.$store.dispatch('passbook/subInitState4Mob', websiteState);
            this.gobackHandle();
          })
          .catch((err) => {
            this.ctrl.loading = false;
            this.error = err.message;

            setTimeout(() => {
              this.error = '';
            }, 6000);
          });
      }
    },
    deleteItemHandle() {
      if (this.$refs.dataForm.validate()) {
        const data = this.transferItem;
        const whisperer = new WhispererController();

        this.ctrl.loading = true;
        whisperer
          .sendSimpleMessage(API_RT_DELETE_MOB_ITEM, data)
          .then(async (websiteState) => {
            await this.$store.dispatch('passbook/subInitState4Mob', websiteState);
            this.gobackHandle();
          })
          .catch((err) => {
            this.ctrl.loading = false;
            this.error = err.message;

            setTimeout(() => {
              this.error = '';
            }, 6000);
          });
      }
    },
  },
  mounted() {
    // console.log('>>>>>>>>>>>', this.$route.params);
  },
  watch: {},
};
</script>
<style>
.website-domain-wrap {
  background: rgba(69, 138, 249, 0.1);
  border-radius: 16px;
}

.website-domain-wrap div.edit-sheet-title {
  font-size: 16px;
  font-weight: 500;
  line-height: 22px;
}
.website-domain-wrap div.domain-text {
  color: rgba(69, 138, 249, 1);
  font-size: 14px;
  line-height: 20px;
}
</style>
