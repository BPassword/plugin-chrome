import mutations from './mutations';
import * as actions from './actions';
import * as getters from './getters';

export default {
  namespaced: true,
  actions,
  mutations,
  getters: {
    transferItem: (state) => state.transferItem,
    ...getters,
  },
  state: {
    mobItems: [],
    webItems: [],
    webPlain: null,
    mobPlain: null,
    transferItem: {
      title: '',
      username: '',
      password: '',
      hostname: '',
    },
  },
};
