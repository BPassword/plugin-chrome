import * as types from './mutation-types';

export default {
  [types.UPDATE_WEB_ITEMS](state, items) {
    state.webItems = items || [];
  },
  [types.UPDATE_WEBPLAIN](state, Plain) {
    //Fixed chrome message undefined will response true
    if (typeof Plain === 'object') {
      state.webPlain = Plain;
    }
  },
  [types.UPDATE_MOB_ITEMS](state, items) {
    state.mobItems = items || [];
  },
  [types.UPDATE_MOBPLAIN](state, Plain) {
    //Fixed chrome message undefined will response true
    if (typeof Plain === 'object') {
      state.mobPlain = Plain;
    }
  },
  [types.SET_TRANFER_ITEM](state, item) {
    state.transferItem = Object.assign({}, item);
  },
};
