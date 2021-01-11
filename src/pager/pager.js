import Vue from 'vue';

import vuetify from '../ui/vuetify/index';

import App from './App';
import store from './store';
import router from './router';
import i18n from '@/locale';

global.p2 = new Vue({
  // el: '#app',
  i18n,
  vuetify,
  store,
  router,
  render: (h) => h(App),
}).$mount('#app');
