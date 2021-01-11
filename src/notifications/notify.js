import Vue from 'vue';

import vuetify from '../ui/vuetify/index';

import App from './App';
import store from './store';
import router from './router';
import i18n from '@/locale';

global.notify = new Vue({
  // el: '#app',
  i18n,
  vuetify,
  store,
  router,
  render: (h) => h(App),
}).$mount('#app');
