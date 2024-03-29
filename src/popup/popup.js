import Vue from 'vue';
import App from './App';
import { nanoid } from 'nanoid';

import vuetify from '../ui/vuetify/index';
import '@ui/assets/css/p3.css';

import store from '../store';
import router from './router';

import i18n from '@/locale';
import Toast from '../ui/toast/index';
Vue.use(Toast);

import LivedManager from '@/libs/messages/lived-manager';
/** Styles */
// import '../ui/assets/css/main.css'

// global.browser = require('webextension-polyfill');
// Vue.prototype.$browser = global.browser;

// communicate backend
import { ENV_TYPE_POPUP } from '@/libs/enums';
const livedManager = new LivedManager({
  portName: ENV_TYPE_POPUP,
  store,
});

global.$lived = livedManager;

Vue.prototype.$uid = nanoid;
/* eslint-disable no-new */
global.p3 = new Vue({
  // el: '#app',
  i18n,
  vuetify,
  store,
  router,
  render: (h) => h(App),
}).$mount('#app');
