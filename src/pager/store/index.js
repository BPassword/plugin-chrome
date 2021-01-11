import * as actions from './actions';
import * as getters from './getters';
import mutations from './mutations';
export default {
  actions,
  mutations,
  getters: {
    isUnlocked: (state) => state.isUnlocked,
    ...getters,
  },
  state: {
    items: [],
    isUnlocked: false,
    feildVolume: {
      username: '',
      password: '',
    },
    trash: [],
    hostname: '',
  },
};
