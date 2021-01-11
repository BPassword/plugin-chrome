import * as types from './mutation-types';

/*********************************************************************
 * AircraftClass ::
 *		@description: Refactor & add web3 state
 *		@description:
 * WARNINGS:
 *
 * HISTORY:
 *		@author: lanbery@gmail.com
 *		@created:  2020-12-29
 *		@comments:
 **********************************************************************/
/**
 *
 * @param {*} param0
 * @param {*} networkState
 */
export const subInitNetworkState = async ({ commit }, networkState) => {
  if (networkState) {
    const { chainId, networks, rpcUrl = '' } = networkState;
    commit(types.UPDATE_RPC_URL, rpcUrl);
    commit(types.UPDATE_NETWORK_LIST, networks);
    commit(types.UPDATE_CHAINID, chainId);
  }
};

/**
 *
 * @param {Object} context vuex
 * @param {Object} web3State [chainBalances,chainTxs,chainId,ts]
 */
export const subInitWeb3State = async ({ commit }, web3State = {}) => {
  const {
    chainBalances = {},
    chainTxs = [],
    chainStatus,
    gasState,
    chainAllowance = {},
  } = web3State;
  commit(types.UPDATE_GAS_STATE, gasState);
  commit(types.UPDATE_CHAIN_BALANCES, chainBalances);
  commit(types.UPDATE_CHAIN_STATUS, chainStatus);
  commit(types.UPDATE_CHAIN_ALLOWANCE, chainAllowance);

  commit(types.SET_CHAIN_TXS, chainTxs);
};

export const updateCurrentNetwork = async ({ commit }, chainId) => {
  commit(types.UPDATE_CHAINID, chainId);
};

/**
 * recharaged used
 * @param {object} context vuex
 * @param {object} chainStatus
 */
export const updateChainStatus = async ({ commit }, chainStatus = {}) => {
  commit(types.UPDATE_CHAIN_STATUS, chainStatus);
};

/**
 *
 * @param {object} context vuex
 * @param {string} selectedAddress
 */
export const updateSelectedAddress = async ({ commit }, selectedAddress) => {
  commit(types.UPDATE_SELECTED_ADDRESS, selectedAddress);
};

/**
 * insert new txState ,this state will overide by received backend chainTxs
 * @param {*} param0
 * @param {object} txState [reqId required]
 */
export const addTxState = async ({ commit }, txState) => {
  if (typeof txState === 'object' && txState.reqId) {
    commit(types.ADD_UI_TX_STATE, txState);
  }
};

export const addOrUpdateChainTxState = async ({ commit }, txState) => {
  commit(types.ADD_OR_UPDATE_UI_TX_STATE, txState);
};

// update chainTxs
export const updateChainTxs = async ({ commit }, chainTxs) => {
  if (Array.isArray(chainTxs)) {
    commit(types.SET_CHAIN_TXS, chainTxs);
  }
};

/**
 * 更新授权余额
 * @param {object} context
 * @param {string|number} allowanceWei
 */
export const updateBTAllowance = async ({ commit }, allowanceWei) => {
  commit(types.UPDATE_CHAIN_BT_ALLOWANCE, allowanceWei);
};
