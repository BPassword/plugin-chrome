import axios from 'axios';
import { debounce } from 'lodash';
import EventEmitter from 'events';
import ObservableStore from 'obs-store';
import ComposedStore from 'obs-store/lib/composed';
import moment from 'moment';
import Web3 from 'web3';

import { SmartAddressesTranslate } from './contracts/index';
import logger from '../logger';
import BizError from '../biz-error';

import {
  MEMBER_COSTWEI_PER_YEAR,
  DEFAULT_GAS_LIMIT,
  TX_PENDING,
  DEFAULT_GAS_STATION_URL,
  DEFAULT_GAS_PRICE,
  GAS_LIMIT_PLUS_RATE,
} from './cnst';

import {
  BT_TOKEN,
  ETH_TOKEN,
  BT_APPRPOVE_ESGAS,
  BPT_MEMBER_RECHARGE_ESGAS,
  BPT_STORAGE_WEB_COMMIT_ESGAS,
  BPT_STORAGE_MOB_COMMIT_ESGAS,
  BPT_MEMBER,
  ESTIMATE_GAS_NUMBER,
} from './contracts/enums';

import { signedRawTxData4Method } from './send-rawtx';

import { getWeb3Inst, compareWei, validGasFeeEnought, getChainConfig } from './web3-helpers';
import {
  getMemberBaseInFo,
  getBptMemberAddress,
  getBPTMemberContractInst,
} from './apis/bpt-member-api';
import { getBTContractInst } from './apis/bt-api';

import { getWebStorageEventInst } from './apis/web-storage-event-api';
import { getMobStorageEventInst } from './apis/mob-storage-event-api';

import {
  INTERNAL_ERROR,
  ACCOUNT_NOT_EXISTS,
  INSUFFICIENT_BTS_BALANCE,
  WALLET_LOCKED,
  PROVIDER_ILLEGAL,
  MEMBERSHIP_EXPIRED,
} from '../biz-error/error-codes';

/*********************************************************************
 * AircraftClass ::
 *		@description: Migeration from Firefox
 *		@description:
 * WARNINGS:
 *
 * HISTORY:
 *		@author: lanbery@gmail.com
 *		@created:  2020-12-28
 *		@comments:
 **********************************************************************/

class Web3Controller extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.getCurrentProvider = opts.getCurrentProvider;

    this.getCurrentWalletState = opts.getCurrentWalletState;

    const initState = opts.initState || {};

    const {
      config = _initConfigState(),
      smarts = SmartAddressesTranslate(),
      balances = {},
      historys = {},
      txs = {},
      status = {},
      allowance = {},
    } = initState;

    this.configStore = new ObservableStore(config);
    this.smartStore = new ObservableStore(smarts);
    this.balanceStore = new ObservableStore(balances);
    this.txStore = new ObservableStore(txs);
    this.historyStore = new ObservableStore(historys);
    this.statusStore = new ObservableStore(status);
    this.allowStore = new ObservableStore(allowance);

    this.store = new ComposedStore({
      config: this.configStore,
      smarts: this.smartStore,
      balances: this.balanceStore,
      historys: this.historyStore,
      txs: this.txStore,
      status: this.statusStore,
      allowance: this.allowStore,
    });

    /** listeners */
    this.setMaxListeners(5);

    this.on('web3:reload:gasstation', _loadGasStation.bind(this));

    this.on('web3:reload:gasStation:delay', debounce(_loadGasStation.bind(this), 50));

    this.on('web3:reload:chain:status-noerror', debounce(_reloadChainStatus.bind(this), 50));
    this.on('web3:reload:chain:config-base-noerror', debounce(_reloadChainConfig.bind(this), 50));

    this.on(
      'web3:update:estimateGas:delay',
      debounce(this.updateEstimateGasConfig.bind(this), 3 * 1000)
    );

    /** for startup or reload runtime */
    this.on('web3:reload:balances:delay', debounce(this._reloadBalancesNoeeror.bind(this), 500));
  }

  /** ======================== Public Methods ============================ */
  async reloadBalances() {
    const { chainId, rpcUrl } = this.getCurrentProvider();
    const { selectedAddress } = this.getCurrentWalletState();
    return _reloadBalances.call(this, rpcUrl, chainId, selectedAddress);
  }

  getChainAllowance(chainId) {
    const wholeState = this.allowStore.getState() || {};
    return wholeState[chainId] || {};
  }

  updateEstimateGasConfig(gasUsedState, chainId) {
    if (!chainId) {
      chainId = this.getCurrentProvider().chainId;
    }

    if (typeof gasUsedState === 'object') {
      const wholeState = this.statusStore.getState();
      const old = wholeState[chainId] || {};
      const updateState = {
        [chainId]: {
          ...old,
          ...gasUsedState,
        },
      };

      this.statusStore.updateState(updateState);
    }
  }

  /**
   *
   * @param {object} allowanceState [BPT_MEMBER:value]
   * @param {number} chainId
   */
  updateAllowanceState(allowanceState, chainId) {
    if (!chainId) {
      chainId = this.getCurrentProvider().chainId;
    }

    const wholeState = this.allowStore.getState() || {};
    let old = wholeState[chainId] || {};
    const upState = {
      [chainId]: {
        ...old,
        ...allowanceState,
      },
    };

    this.allowStore.updateState(upState);
  }

  getChainAllowance(chainId) {
    if (!chainId) {
      chainId = this.getCurrentProvider().chainId;
    }
    const wholeState = this.allowStore.getState() || {};
    return wholeState[chainId];
  }

  /**
   *
   * @param {string} key required
   * @param {number} chainId optional
   */
  lastEstimateGas(key, chainId) {
    if (!chainId) {
      chainId = this.configStore.getState().chainId;
    }

    const statusState = this.statusStore.getState();
    if (statusState[chainId] && statusState[chainId][key]) {
      return statusState[chainId][key] || 0;
    }
    return 0;
  }

  getChainTxs(chainId) {
    const txs = this.txStore.getState();
    let chainTxs = [];
    if (chainId && txs && typeof txs === 'object' && Object.values(txs).length > 0) {
      chainTxs = Object.values(txs).filter((tx) => tx.chainId === chainId);
    }

    return chainTxs;
  }

  getPendingTxs(chainId) {
    const txsState = this.txStore.getState();
    let pendingTxs = [];
    if (txsState && Object.values(txsState).length > 0) {
      pendingTxs = Object.values(txsState).filter(
        (tx) => tx.chainId === chainId && tx.statusText === TX_PENDING
      );
    }

    return pendingTxs;
  }

  updateMembershipDeadline(chainId, membershipDeadline) {
    let wholeState = this.statusStore.getState();
    if (chainId && membershipDeadline) {
      let chainState = wholeState[chainId] || {};
      const newState = {
        [chainId]: {
          ...chainState,
          membershipDeadline,
        },
      };

      this.statusStore.updateState(newState);
    }
  }

  async chainTxStatusUpdateForUI(txState) {
    const txs = await this.txStore.getState();
    const { chainId, reqId } = txState || {};
    if (!reqId || !chainId) {
      throw new BizError('TxState must contains reqId,chainId and txHash');
    }

    let uid = `${chainId}_${reqId}`;
    const oldState = txs[uid] || {};

    const newState = {
      [uid]: {
        ...oldState,
        ...txState,
      },
    };

    this.txStore.updateState(newState);

    return this.getChainTxs(chainId);
  }

  async getBalanceState() {
    const { chainId } = await this.getCurrentProvider();
    const wholeState = this.balanceStore.getState() || {};

    if (!chainId) {
      throw new BizError('provider chainId unfound', PROVIDER_ILLEGAL);
    }

    if (!wholeState || !wholeState[chainId]) {
      return {
        [ETH_TOKEN]: '0',
        [BT_TOKEN]: '0',
      };
    }
    return wholeState[chainId];
  }

  getSendState(chainId) {
    const { balances = {}, txs = {}, config = {}, status = {} } = this.store.getState();
    if (!chainId) {
      chainId = config.chainId;
    }

    let chainBalances = {},
      chainStatus = {},
      chainTxs = [];
    if (chainId && typeof balances[chainId] === 'object') {
      chainBalances = balances[chainId];
    }
    if (chainId && txs && typeof txs === 'object' && Object.values(txs).length > 0) {
      chainTxs = Object.values(txs).filter((tx) => tx.chainId === chainId);
    }

    if (chainId && status[chainId]) {
      chainStatus = {
        ...ESTIMATE_GAS_NUMBER,
        ...status[chainId],
      };
    }

    const configState = this.configStore.getState();
    let gasState = _translateGasStation(configState, chainId);

    let chainAllowance = this.getChainAllowance(chainId);

    let sendState = {
      gasState,
      chainStatus,
      chainId,
      chainBalances,
      chainTxs,
      chainAllowance,
    };

    return sendState;
  }

  /** --------------------------------- Signed Methods ------------------------------------ */
  async signedBTApproved4Member(reqData) {
    logger.debug('signedBTApproved4Member>>>>>>>>>>>>>>>>', reqData);
    const { reqId, gasPriceSwei = 0 } = reqData;
    if (!reqId) {
      throw new BizError('Miss parameter txReqId', PARAMS_ILLEGAL);
    }
    return await _signedApproved4Member.call(this, reqId, gasPriceSwei);
  }

  async signedRegistedMemberByYear(reqData) {
    const { reqId, gasPriceSwei = 0 } = reqData;
    if (!reqId) {
      throw new BizError('Miss parameter reqId', PARAMS_ILLEGAL);
    }

    return await _signedRegistMember.call(this, reqId, gasPriceSwei, 1);
  }

  async signedWebsiteCommitCypher(reqId, gasPriceSwei, Cypher64) {
    return await _SignedWebsiteCommitCypher.call(this, reqId, gasPriceSwei, Cypher64);
  }

  async signedMobileCommitCypher(reqId, gasPriceSwei, Cypher64) {
    return _SignedMobileCommitCypher.call(this, reqId, gasPriceSwei, Cypher64);
  }
  /** ------------ private methods -------- */
  async _reloadBalancesNoeeror() {
    try {
      const { chainId, rpcUrl } = this.getCurrentProvider();
      const { selectedAddress } = this.getCurrentWalletState();
      if (!chainId || !rpcUrl || !selectedAddress) {
        throw new BizError('miss params,maybe logout or no account.', INTERNAL_ERROR);
      }
      _reloadBalances.call(this, rpcUrl, chainId, selectedAddress);
    } catch (err) {
      logger.warn('reload balances and allowance failed.', err.message);
    }
  }
}

export default Web3Controller;

/** +++++++++++++++++++++++ File Scope Private Functions +++++++++++++++++++++++++++++ */

/**
 * query token balance ,allowances & update storage balanceStore,allowStore
 * @param {string} rpcUrl
 * @param {number} chainId
 * @param {string} selectedAddress
 */
async function _reloadBalances(rpcUrl, chainId, selectedAddress) {
  if (!rpcUrl || !chainId || !selectedAddress) {
    throw new BizError('Params [rpcUrl,chainId or selectedAddress] illegal.', INTERNAL_ERROR);
  }

  const web3js = getWeb3Inst(rpcUrl);
  const ethBalance = await web3js.eth.getBalance(selectedAddress);

  const tokenInst = getBTContractInst(web3js, chainId, selectedAddress);
  const btsBalance = await tokenInst.methods.balanceOf(selectedAddress).call();

  const balances = {
    [chainId]: {
      [ETH_TOKEN]: ethBalance || 0,
      [BT_TOKEN]: btsBalance || 0,
    },
  };

  this.balanceStore.updateState(balances);

  const spender = getBptMemberAddress(chainId);
  const allowanceWei = await tokenInst.methods.allowance(selectedAddress, spender).call();

  const allowanceState = {
    [BPT_MEMBER]: allowanceWei,
  };

  this.updateAllowanceState(allowanceState, chainId);

  // deadline
  const memberInfo = await getMemberBaseInFo(web3js, chainId, selectedAddress);
  this.statusStore.updateState(memberInfo);

  return this.getSendState(chainId);
}

function _initConfigState() {
  return {
    gasLimit: DEFAULT_GAS_LIMIT,
  };
}

function _translateGasStation(configState) {
  const fromWei = Web3.utils.fromWei;
  let defaultGasPrice = DEFAULT_GAS_PRICE;

  if (configState && configState.gasPrice) {
    defaultGasPrice = configState['gasPrice'];
  }
  const { gasLimit = DEFAULT_GAS_LIMIT, gasStation } = configState;

  const averageGwei = fromWei(defaultGasPrice.toString(), 'Gwei');
  const defAvg = parseFloat(averageGwei) * 10;

  let gasState = {
    gasLimit,
    average: defAvg,
    safeLow: defAvg / 2,
    fast: defAvg,
    fastest: defAvg * 2,
    gasPrice: defAvg,
    ...gasStation,
  };

  return gasState;
}

async function _loadGasStation(url) {
  const opts = {
    timeout: 3000,
    withCredentials: true,
  };
  try {
    const resp = await axios.get(url || DEFAULT_GAS_STATION_URL, opts);
    if (resp && resp.status === 200 && resp.data) {
      let gasStation = resp.data;
      delete gasStation.gasPriceRange;
      // logger.debug('Gas Station Loaded:>>>>>', gasStation);
      this.configStore.updateState({ gasStation });

      return gasStation;
    } else {
      return false;
    }
  } catch (err) {
    logger.warn('Gas Station Loading failed.', err.message);
  }
}

/**
 * noerror
 * @param {object} provider
 * @param {string} selectedAddress
 */
async function _reloadChainStatus(provider, selectedAddress) {
  try {
    if (!provider || !selectedAddress) {
      throw new BizError('params illegal.', PROVIDER_ILLEGAL);
    }
    const { rpcUrl, chainId } = provider;
    const web3js = getWeb3Inst(rpcUrl);
    const info = await getMemberBaseInFo(web3js, chainId, selectedAddress);
    this.statusStore.updateState(info);
  } catch (err) {
    logger.warn('reload chain status failed.', err.message);
  }
}

/**
 * TODO
 * @param {object} provider [rpcUrl]
 */
async function _reloadChainConfig(provider) {
  try {
    const { rpcUrl } = await provider;
    const web3js = getWeb3Inst(rpcUrl);
    //chain chainId,gasPrice miner
    const chainState = await getChainConfig(web3js);

    this.configStore.updateState(chainState);
  } catch (err) {
    logger.warn('reload chain config failed', err);
  }
}

/** $--------------- Signed Private ---------------$ */
async function _signedApproved4Member(reqId, gasPriceSwei) {
  const toWei = Web3.utils.toWei;
  const walletState = this.getCurrentWalletState();
  const _provider = this.getCurrentProvider();

  if (!_provider) {
    throw new BizError('provider miss', INTERNAL_ERROR);
  }
  if (
    !walletState ||
    !walletState.isUnlocked ||
    !walletState.dev3 ||
    !walletState.selectedAddress
  ) {
    throw new BizError('Extension logout or no account.', ACCOUNT_NOT_EXISTS);
  }

  const { chainId, rpcUrl } = _provider;
  const { selectedAddress, dev3 } = walletState;

  const web3js = getWeb3Inst(rpcUrl);
  const tokenInst = getBTContractInst(web3js, chainId, selectedAddress);
  const tokenAddress = tokenInst._address;

  let btsBalance = await tokenInst.methods.balanceOf(selectedAddress).call();
  const { chainStatus = {} } = this.getSendState(chainId);
  let memberCostWeiPerYear = chainStatus.memberCostWeiPerYear || MEMBER_COSTWEI_PER_YEAR;
  if (compareWei(btsBalance, memberCostWeiPerYear) < 0) {
    throw new BizError('Insuffient BT Balance.', INSUFFICIENT_BTS_BALANCE);
  }

  let { chain, gasPrice, gasStation = {} } = this.configStore.getState();
  const approveAddress = getBptMemberAddress(chainId);
  const dataABI = tokenInst.methods.approve(approveAddress, btsBalance).encodeABI();

  // config[BT_APPRPOVE_ESGAS];
  let lastApproveGas = this.lastEstimateGas(BT_APPRPOVE_ESGAS, chainId); // config[BT_APPRPOVE_ESGAS];
  if (!lastApproveGas || lastApproveGas) {
    lastApproveGas = await tokenInst.methods
      .approve(approveAddress, btsBalance)
      .estimateGas({ from: selectedAddress });

    const updateGasState = { [BT_APPRPOVE_ESGAS]: lastApproveGas };
    this.emit('web3:update:estimateGas:delay', updateGasState, chainId);
  }

  // this will from custom UI set
  let gasLimit = parseInt(parseFloat(lastApproveGas) * GAS_LIMIT_PLUS_RATE);
  let avg = gasStation.average;
  if (gasPriceSwei && gasPriceSwei !== '0') {
    gasPrice = toWei((gasPriceSwei / 10).toString(), 'Gwei');
  } else if (avg && avg != '0') {
    gasPrice = toWei((avg / 10).toString(), 'Gwei');
  }

  let ethBal = await web3js.eth.getBalance(selectedAddress);
  const diamondsFee = validGasFeeEnought(ethBal, gasPrice, gasLimit);

  const txParams = {
    gasLimit,
    gasPrice,
    value: 0,
    to: tokenAddress,
  };
  logger.debug('approveAddress:>>>BTs>', txParams, diamondsFee);

  const txData = await signedRawTxData4Method(web3js, dev3, txParams, dataABI, {
    chainId,
    chain,
    selectedAddress,
  });
  logger.debug('Web3 signed data hex string:', txData.nonce, txData.rawData);

  return {
    reqId,
    chainId,
    diamondsFee,
    willAllowance: btsBalance,
    nonce: txData.nonce,
    rawData: txData.rawData,
  };
}

/**
 *
 * @param {string} reqId
 * @param {number} gasPriceSwei
 * @param {number} charageType
 */
async function _signedRegistMember(reqId, gasPriceSwei, charageType = 1) {
  const toWei = Web3.utils.toWei;
  const { isUnlocked, selectedAddress, dev3 } = this.getCurrentWalletState();
  if (!isUnlocked || !selectedAddress || !dev3) {
    throw new BizError('Extension logout or no account.', ACCOUNT_NOT_EXISTS);
  }

  const { rpcUrl, chainId } = this.getCurrentProvider();

  if (!rpcUrl || !chainId) {
    throw new BizError('Current Provider illegal.', INTERNAL_ERROR);
  }

  // Instance defined
  const approveAddress = getBptMemberAddress(chainId);
  const web3js = getWeb3Inst(rpcUrl);
  const tokenInst = getBTContractInst(web3js, chainId, selectedAddress);
  const bptMemberInst = getBPTMemberContractInst(web3js, chainId, selectedAddress);

  const { chainStatus = {} } = this.getSendState(chainId);
  let { chain, gasPrice, gasStation = {} } = this.configStore.getState();

  let memberCostWeiPerYear =
    chainStatus.memberCostWeiPerYear || toWei(MEMBER_COSTWEI_PER_YEAR, 'ether');

  //check bts allownce
  const btsBalance = await tokenInst.methods.balanceOf(selectedAddress).call();
  if (compareWei(btsBalance, memberCostWeiPerYear) < 0) {
    throw new BizError('Insuffient BT balance.', INSUFFICIENT_BTS_BALANCE);
  }

  const allowBalance = await tokenInst.methods.allowance(selectedAddress, approveAddress).call();

  if (compareWei(allowBalance, memberCostWeiPerYear) < 0) {
    throw new BizError('Insuffient BT balance allowance.', INSUFFICIENT_BTS_BALANCE);
  }

  let gasLimit = this.lastEstimateGas(BPT_MEMBER_RECHARGE_ESGAS, chainId);

  if (!gasLimit) {
    gasLimit = await bptMemberInst.methods
      .RechargeByType(charageType)
      .estimateGas({ from: selectedAddress });

    const updateGasState = { [BPT_MEMBER_RECHARGE_ESGAS]: gasLimit };
    this.emit('web3:update:estimateGas:delay', updateGasState, chainId);
  }

  let avg = gasStation.average;
  if (gasPriceSwei > 0) {
    gasPrice = toWei((gasPriceSwei / 10).toString(), 'Gwei');
  } else if (avg > 0) {
    gasPrice = toWei((avg / 10).toString(), 'Gwei');
  }

  //check eth balance
  let ethBal = await web3js.eth.getBalance(selectedAddress);
  const diamondsFee = validGasFeeEnought(ethBal, gasPrice, gasLimit);

  const dataABI = bptMemberInst.methods.RechargeByType(charageType).encodeABI();

  const txParams = {
    gasLimit,
    gasPrice,
    value: 0,
    to: approveAddress,
  };

  const txData = await signedRawTxData4Method(web3js, dev3, txParams, dataABI, {
    chain,
    chainId,
    selectedAddress,
  });

  return {
    reqId,
    chainId,
    diamondsFee,
    nonce: txData.nonce,
    rawData: txData.rawData,
  };
}

async function _SignedWebsiteCommitCypher(reqId, gasPriceSwei, Cypher64) {
  const toWei = Web3.utils.toWei;
  const bytesToHex = Web3.utils.bytesToHex;
  const { chainId, rpcUrl } = await this.getCurrentProvider();
  const { isUnlocked, selectedAddress, dev3 } = await this.getCurrentWalletState();

  if (!reqId || !Cypher64 || !chainId || !rpcUrl || !selectedAddress) {
    throw new BizError('Params illegal.', INTERNAL_ERROR);
  }

  if (!isUnlocked || !dev3 || !dev3.SubPriKey) {
    throw new BizError('Account logout.', WALLET_LOCKED);
  }

  const balanceState = await this.getBalanceState();
  const web3js = getWeb3Inst(rpcUrl);
  let ethwei = balanceState[ETH_TOKEN] || '0';

  const storageInst = getWebStorageEventInst(web3js, chainId, selectedAddress);

  const toContractAddress = storageInst._address;

  const cypherBytes = ExtractCommit(dev3.SubPriKey, Cypher64);
  const cypher64Hex = bytesToHex(cypherBytes);

  //valid sdk parse bytes
  validSdkExtractCommit(dev3.SubPriKey, cypherBytes);

  await _validMembership(web3js, chainId, selectedAddress);

  let gasLimitNumber = await this.lastEstimateGas(BPT_STORAGE_WEB_COMMIT_ESGAS, chainId);
  if (!gasLimitNumber) {
    gasLimitNumber = await storageInst.methods
      .commit(cypher64Hex)
      .estimateGas({ from: selectedAddress });

    const updateGasState = {
      [BPT_STORAGE_WEB_COMMIT_ESGAS]: gasLimitNumber,
    };
    this.emit('web3:update:estimateGas:delay', updateGasState, chainId);
  }

  let { chain, gasPrice, gasStation = {} } = this.configStore.getState();

  let avg = gasStation.average;
  if (gasPriceSwei > 0) {
    gasPrice = toWei((gasPriceSwei / 10).toString(), 'Gwei');
  } else if (avg > 0) {
    gasPrice = toWei((avg / 10).toString(), 'Gwei');
  }

  const diamondsFee = validGasFeeEnought(ethwei, gasPrice, gasLimitNumber);

  let dataABI = await storageInst.methods.commit(cypher64Hex).encodeABI();

  let txParams = {
    gasLimit: gasLimitNumber,
    gasPrice,
    value: 0,
    to: toContractAddress,
  };

  const txData = await signedRawTxData4Method(web3js, dev3, txParams, dataABI, {
    chain,
    chainId,
    selectedAddress,
  });

  logger.debug('txData >>>>>>>>', txData);
  return {
    reqId,
    chainId,
    rpcUrl,
    diamondsFee,
    paramHex: cypher64Hex,
    nonce: txData.nonce,
    rawData: txData.rawData,
  };
}

async function _SignedMobileCommitCypher(reqId, gasPriceSwei, Cypher64) {
  const toWei = Web3.utils.toWei;
  const bytesToHex = Web3.utils.bytesToHex;

  const { chainId, rpcUrl } = await this.getCurrentProvider();
  const { isUnlocked, selectedAddress, dev3 } = await this.getCurrentWalletState();

  if (!reqId || !Cypher64 || !chainId || !rpcUrl || !selectedAddress) {
    throw new BizError('Params illegal.', INTERNAL_ERROR);
  }

  if (!isUnlocked || !dev3 || !dev3.SubPriKey) {
    throw new BizError('Account logout.', WALLET_LOCKED);
  }

  const balanceState = await this.getBalanceState();

  const web3js = getWeb3Inst(rpcUrl);
  let ethwei = balanceState[ETH_TOKEN] || '0';
  const storageInst = getMobStorageEventInst(web3js, chainId, selectedAddress);

  const toContractAddress = storageInst._address;

  const cypherBytes = ExtractCommit(dev3.SubPriKey, Cypher64);
  const cypher64Hex = bytesToHex(cypherBytes);

  //valid sdk parse bytes
  validSdkExtractCommit(dev3.SubPriKey, cypherBytes);

  let gasLimit = this.lastEstimateGas(BPT_STORAGE_MOB_COMMIT_ESGAS, chainId);

  await _validMembership(web3js, chainId, selectedAddress);

  if (!gasLimit) {
    gasLimit = await storageInst.methods.commit(cypherBytes).estimateGas({ from: selectedAddress });

    const updateGasState = {
      [BPT_STORAGE_MOB_COMMIT_ESGAS]: gasLimit,
    };
    this.emit('web3:update:estimateGas:delay', updateGasState, chainId);
  }

  let { chain, gasPrice, gasStation = {} } = this.configStore.getState();
  const avg = gasStation.average;
  if (gasPriceSwei > 0) {
    gasPrice = toWei((gasPriceSwei / 10).toString(), 'Gwei');
  } else if (avg > 0) {
    gasPrice = toWei((avg / 10).toString(), 'Gwei');
  }

  const diamondsFee = validGasFeeEnought(ethwei, gasPrice, gasLimit);

  let dataABI = await storageInst.methods.commit(cypher64Hex).encodeABI();

  let txParams = {
    gasLimit,
    gasPrice,
    value: 0,
    to: toContractAddress,
  };

  const txData = await signedRawTxData4Method(web3js, dev3, txParams, dataABI, {
    chain,
    chainId,
    selectedAddress,
  });

  return {
    reqId,
    chainId,
    rpcUrl,
    diamondsFee,
    paramHex: cypher64Hex,
    nonce: txData.nonce,
    rawData: txData.rawData,
  };
}

function validSdkExtractCommit(subPriKey, cypherBytes) {
  var chainData = new ChainCmdArray();
  chainData.DecryptChainCmdArray(subPriKey, cypherBytes);
  // check used 3rd packate
  if (!chainData.data || !chainData.data.length) {
    throw new BizError('call Sdk ExtractCommit err', INTERNAL_ERROR);
  }
}

async function _validMembership(web3js, chainId, address) {
  const inst = getBPTMemberContractInst(web3js, chainId, address);
  const membershipDeadline = await inst.methods.allMembership(address).call();

  if (!membershipDeadline || membershipDeadline == '0') {
    throw new BizError('non-member', MEMBERSHIP_EXPIRED);
  }

  if (new Date().getTime() / 1000 - parseFloat(membershipDeadline) > 0) {
    const expiredDate = moment(new Date(membershipDeadline * 1000)).format('YYYY-MM-DD');
    throw new BizError(`Membership Expired : [${expiredDate}]`, MEMBERSHIP_EXPIRED);
  }
}
