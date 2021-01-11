import * as types from './mutation-types';
import { fetchEnv3 } from '@/libs/storage/fast-helper';

import { AsyncOpenWallet } from '@/libs/accounts/wallet-generator';

/**
 *
 * @param {object} context vuex context[commit,state,rootState]
 * @param {Object} initState
 */
export const initState = async ({ commit, dispatch }, initState = {}) => {
  const {
    isUnlocked,
    AccountController,
    MobileController,
    WebsiteController,
    env3,
    NetworkController,
    Web3Controller,
  } = initState;

  commit(types.UPDATE_ISUNLOCKED, isUnlocked);
  if (env3) {
    //import has
    commit(types.UPDATE_ENV3, env3);
  }

  if (AccountController) {
    const { selectedAddress = '' } = AccountController;
    await dispatch('web3/updateSelectedAddress', selectedAddress);
  }

  if (NetworkController) {
    await dispatch('web3/subInitNetworkState', NetworkController);
  }

  if (Web3Controller) {
    await dispatch('web3/subInitWeb3State', Web3Controller);
  }

  if (isUnlocked && WebsiteController) {
    await dispatch('passbook/subInitState4Site', WebsiteController);
  }

  if (isUnlocked && MobileController) {
    await dispatch('passbook/subInitState4Mob', MobileController);
  }
};

export const loadEnv3FromLocale = async ({ commit }) => {
  const env3 = await fetchEnv3();
  commit(types.UPDATE_ENV3, env3);
};

/**
 * create or import wallet
 * @param {*} param0
 * @param {*} env3
 */
export const updateWalletState = async ({ commit, dispatch }, respState = {}) => {
  commit(types.UPDATE_ENV3, respState.env3);
  await dispatch('initState', respState);
};

export const unlockEnv3ForPopup = async ({ state }, password) => {
  const env3 = state.env3;
  if (!env3) throw 'env3 not exists.';

  try {
    const dev3 = await AsyncOpenWallet(env3, password);
    return {
      json: JSON.stringify(env3),
      dev3,
    };
  } catch (err) {
    console.warn('env3 decrypted failed.', err);
    throw err;
  }
};
