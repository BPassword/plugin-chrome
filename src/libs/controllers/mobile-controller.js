import EventEmitter from 'events';
import ObservableStore from 'obs-store';
import ComposedStore from 'obs-store/lib/composed';

import logger from '@/libs/logger';
import BizError from '@lib/biz-error';
import { transferTerms } from '../utils/item-transfer';
import {
  VEX_ITEM_EXIST,
  VEX_ITEM_EDIT,
  VEX_ITEM_DELETE,
  INTERNAL_ERROR,
} from '@lib/biz-error/error-codes';

import { getWeb3Inst } from '../web3/web3-helpers';
import { fetchEventLogsFromChain } from '../web3/apis/mob-storage-event-api';

/*********************************************************************
 * AircraftClass ::Mobile passbook management
 *     @description : store encrypt data and history
 *     @description : update block chain store struct
 * WARNINGS:
 *     this class dependency global api data_store
 * HISTORY:
 *     @author : lanbery@gmail.com
 *     @Created :  2020-11-06
 *     @comments : 2020-12-28 add blockchain storage struct
 **********************************************************************/

const StateStruct = {
  blockerVersion: [], //{blockNumber,Cypher64,contactAddress,Hash,mainAddress,chainId}
  lastSyncHash: null, //save this client last sync block success hash
};

class MobileController extends EventEmitter {
  /**
   *
   * @param {object} opts
   *
   */
  constructor(opts = {}) {
    super();

    this.getCurrentWalletState = opts.getCurrentWalletState;
    this.getCurrentProvider = opts.getCurrentProvider;

    const initState = opts.initState || {};
    const { chainState = {}, versionState = {} } = initState;

    /**
     *
     */
    this.chainStore = new ObservableStore(chainState);
    this.versionStore = new ObservableStore(versionState);

    this.store = new ComposedStore({
      chainState: this.chainStore,
      versionState: this.versionStore,
    });

    this.memStore = new ObservableStore();
  }

  async locked() {
    this.memStore.putState({ Plain: null, items: [] });
  }

  async unlock(SubPriKey) {
    let Cypher64, Plain;
    try {
      Cypher64 = this.getCypher64();
      if (!Cypher64) {
        const f = InitFile(SubPriKey);
        Plain = f.Plain;
        Cypher64 = f.Cypher64;
        this.updateLocalChainState(Cypher64);
      } else {
        Plain = decryptToPlainTxt(SubPriKey, Cypher64);
      }
      if (typeof Plain.unwrap === 'function') {
        Plain = Plain.unwrap();
      }

      const items = transferTerms(Plain);

      //update memStore
      this.memStore.updateState({ Plain, items, SubPriKey });
    } catch (error) {
      console.warn('decrypted Mobile Cypher64 to Plain failed.', error);
      throw 'decrypted Mobile Cypher64 to Plain failed.';
    }
  }

  async addItem(subKey, data = {}) {
    if (!subKey) throw new BizError('lost subPriKey.', INTERNAL_ERROR);
    if (!data) throw new BizError('lost item data.', INTERNAL_ERROR);

    const cypher64 = this.getCypher64();
    if (!cypher64) throw new BizError('local cypher lost.', INTERNAL_ERROR);

    const { title, username, password } = data;

    try {
      const f = UpdateCmdAdd(subKey, cypher64, new Term(title, username, password));
      const { Plain, Cypher64 } = f;

      this.updateLocalChainState(Cypher64);
      this.reloadMemStore(Plain, Cypher64);
      return await this.getState();
    } catch (error) {
      logger.warn('add website item failed', error);
      throw new BizError(`Title:${title} has been exist.`, VEX_ITEM_EXIST);
    }
  }

  async updateItem(subKey, data = {}) {
    if (!subKey) throw new BizError('lost subPriKey.', INTERNAL_ERROR);
    if (!data) throw new BizError('lost item data.', INTERNAL_ERROR);

    const cypher64 = this.getCypher64();
    if (!cypher64) throw new BizError('local cypher lost.', INTERNAL_ERROR);

    const { title, username, password } = data;
    try {
      const f = UpdateCmdChange(subKey, cypher64, new Term(title, username, password));
      const { Plain, Cypher64 } = f;
      this.updateLocalChainState(Cypher64);
      await this.reloadMemStore(Plain, Cypher64);

      return await this.getState();
    } catch (err) {
      logger.error(err);
      throw new BizError(`Title ${title} unfound.`, VEX_ITEM_EDIT);
    }
  }

  async deleteItem(subKey, data = {}) {
    if (!subKey) throw new BizError('lost subPriKey.', INTERNAL_ERROR);
    if (!data || !data.title) throw new BizError('lost item data.', INTERNAL_ERROR);

    const { title } = data;
    const cypher64 = this.getCypher64();
    if (!cypher64) throw new BizError('local cypher lost.', INTERNAL_ERROR);

    try {
      const f = UpdateCmdDelete(subKey, cypher64, new Term(title, null, null));

      const { Plain, Cypher64 } = f;
      this.updateLocalChainState(Cypher64);
      await this.reloadMemStore(Plain, Cypher64);

      return await this.getState();
    } catch (err) {
      logger.warn(err);
      throw new BizError(`Title ${title} unfound.`, VEX_ITEM_DELETE);
    }
  }

  async updateLocalChainState(Cypher64) {
    const { chainId } = this.getCurrentProvider();
    if (!chainId) throw new BizError('lost chainId in current wallet.', INTERNAL_ERROR);

    this.chainStore.updateState({ [chainId]: Cypher64 });
  }

  async reloadMemStore(Plain, cypher64) {
    if (!Plain || !cypher64) {
      return;
    }
    try {
      if (typeof Plain.unwrap === 'function') {
        Plain = Plain.unwrap();
      }
      const items = transferTerms(Plain, true);
      await this.memStore.updateState({ Plain, items });
    } catch (err) {
      logger.warn('reload Mobile items memstate failed.', err.message);
    }
  }

  getCypher64() {
    const { chainId } = this.getCurrentProvider();
    const wholeState = this.chainStore.getState() || {};
    return wholeState && wholeState[chainId] ? wholeState[chainId] : '';
  }

  async getState() {
    const state = await this.memStore.getState();
    return {
      ...state,
    };
  }

  /**
   * 初始化化 Mobile Cypher
   * @param {boolean} force
   */
  async reinitializeCypher(force = false) {
    const { chainId } = this.getCurrentProvider();
    const { dev3 } = this.getCurrentWalletState();

    if (!chainId || !dev3) {
      throw new BizError('Account logout or no account.', WALLET_LOCKED);
    }
    const wholeChainState = this.chainStore.getState() || {};
    let Cypher64 = wholeChainState[chainId];

    let Plain;
    if (force) {
      const f = InitFile(dev3.SubPriKey);
      Plain = f.Plain;
      Cypher64 = f.Cypher64;
      logger.warn('Website locale passbook reset empty.');
      this.chainStore.updateState({ [chainId]: Cypher64 });
    }
    if (!Cypher64) {
      const f = InitFile(dev3.SubPriKey);
      Plain = f.Plain;
      Cypher64 = f.Cypher64;
      this.chainStore.updateState({ [chainId]: Cypher64 });
    }

    if (!Plain) {
      Plain = decryptToPlainTxt(dev3.SubPriKey, Cypher64);
    }

    await this.reloadMemStore(Plain, Cypher64);

    return this.getState();
  }
  /* <--------------------- Sync Block chain Methods ----------------------> */
  getFromBlockNumber() {
    const memState = this.memStore.getState() || {};
    const { Plain = {} } = memState;
    return Plain.BlockNumber || 0;
  }

  async fetchMergeFromBlockChain(fromBlock) {
    const { selectedAddress, dev3 } = this.getCurrentWalletState();
    fromBlock = !fromBlock ? this.getFromBlockNumber() : fromBlock;
    const currCypher64 = await this.getCypher64();
    if (!currCypher64) {
      throw new BizError('Local Cypher Illegal.', INTERNAL_ERROR);
    }

    const logsResp = await _GetFromChainLogs.call(this, selectedAddress, fromBlock);

    const { blockNumber, lastTxHash, logs = [] } = logsResp;
    let retFile = null;
    if (logs.length > 0 && blockNumber > fromBlock) {
      retFile = UpdateBlockData(dev3.SubPriKey, currCypher64, blockNumber, lastTxHash, logs);

      this.reloadMemStore(retFile.Plain, retFile.Cypher64);
      this.updateLocalChainState(retFile.Cypher64);
    }

    return await this.memStore.getState();
  }
}

export default MobileController;

/**
 *
 * @param {number} fromBlock
 */
async function _GetFromChainLogs(selectedAddress, fromBlock = 0) {
  const { chainId, rpcUrl } = this.getCurrentProvider();

  if (!chainId || !rpcUrl || !selectedAddress) {
    throw new BizError('Params illegal', INTERNAL_ERROR);
  }

  const web3js = getWeb3Inst(rpcUrl);
  const respLogs = await fetchEventLogsFromChain(web3js, chainId, selectedAddress, fromBlock);

  return respLogs;
}
