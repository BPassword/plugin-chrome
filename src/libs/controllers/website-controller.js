import { debounce } from 'lodash';
import EventEmitter from 'events';
import ObservableStore from 'obs-store';
import ComposedStore from 'obs-store/lib/composed';

import logger from '@/libs/logger';
import { transferTerms, getDiff } from '../utils/item-transfer';
import {
  VEX_ITEM_EXIST,
  VEX_ITEM_EDIT,
  VEX_ITEM_DELETE,
  INTERNAL_ERROR,
  WALLET_LOCKED,
} from '../biz-error/error-codes';
import extension from '../extensionizer';
import BizError from '@lib/biz-error';

import { getWeb3Inst } from '../web3/web3-helpers';
import { fetchEventLogsFromChain } from '../web3/apis/web-storage-event-api';

/*********************************************************************
 * AircraftClass :: Website passbook management
 *		@description: store encrypt data and history
 *		@description: refactor unlock & locked workflow & migration from firefox
 * WARNINGS:
 *		this class dependency global api data_store
 * HISTORY:
 *		@author: lanbery@gmail.com
 *		@created:  2020-11-06
 *		@comments:
 **********************************************************************/
const StateStruct = {
  blockerVersion: [], //{blockNumber,Cypher64,contactAddress,Hash,mainAddress,chainId}
  lastSyncHash: null, //save this client last sync block success hash
};

class WebsiteController extends EventEmitter {
  /**
   *
   * @param {object} opts
   *
   */
  constructor(opts = {}) {
    super();

    const initState = opts.initState || {};
    const { chainState = {}, versionState = {} } = initState;

    this.getCurrentProvider = opts.getCurrentProvider;
    this.getCurrentWalletState = opts.getCurrentWalletState;

    this.notifyInjet = opts.notifyInjet;
    this.notifyActivedLeech = opts.notifyActivedLeech;
    this.getActivedTabInfo = opts.getActivedTabInfo;

    /**
     * locale State
     * chainId:Cypher64
     */
    this.chainStore = new ObservableStore(chainState);

    /**
     * block chain state
     * lastTxHash: {chainId,lastTxHash ,blockNumber}
     * when sync from block update this state
     * this state will sync block chain
     */
    this.versionStore = new ObservableStore(versionState);

    // this.store = new ObservableStore(Object.assign({}, StateStruct, initState));
    this.store = new ComposedStore({
      chainState: this.chainStore,
      versionState: this.versionStore,
    });

    this.memStore = new ObservableStore();
    /**
     * valt : key tabId: valtState[activeFeild,username,password,hostname]
     */
    this.valtStore = new ObservableStore({});
    this.valtStore.subscribe(this.valtChangedNotifyListener.bind(this));

    /** ------------------------- Registed Listeners ---------------------------------- */
    this.setMaxListeners(2);
    this.on('notify:injet:client', debounce(this.callNotifiedInjetClient.bind(this), 500));

    this.on(
      'notify:activedTab:communications',
      debounce(this.notifyActivedTabCommunications.bind(this), 500)
    );
  }

  /** ==================== Valt store handle start ====================== */
  valtChangedNotifyListener(valtWrap) {
    logger.debug('WebsiteController:valtChangedNotifyListener>>>>>>>>>>>>>>', valtWrap, this);
    // 通知 actived leech page
    if (
      this.notifyActivedLeech &&
      typeof valtWrap === 'object' &&
      valtWrap !== null &&
      Object.keys(valtWrap).length
    ) {
      logger.debug(
        'WebsiteController:valtChangedNotifyListener-notifyActivedLeech>>>>>>>>>>>>>>',
        valtWrap
      );
      const tabId = Object.keys(valtWrap)[0];
      this.notifyActivedLeech(tabId);
    }
  }

  async notifyActivedTabCommunications() {
    if (this.getActivedTabInfo) {
      const info = await this.getActivedTabInfo();
      logger.debug('notifyActivedTabCommunications>>>>>>>>>>>>', info);
      if (info) {
        const { tabId, hostname } = info;
        if (hostname && this.notifyInjet) {
          this.notifyInjet(hostname);
        }

        if (this.notifyActivedLeech && tabId !== undefined) {
          this.notifyActivedLeech(tabId);
        }
      }
    }
  }

  updateActivedTabValtState(tabId, valtState) {
    if (tabId) {
      this.valtStore.updateState({ [tabId]: valtState });
    }
  }

  disconnectResetActivedTabValtState(tabId, hostname = '') {
    const defState = {
      activeFeild: '',
      username: '',
      password: '',
      hostname,
    };
    this.valtStore.putState({ [tabId]: defState });
  }
  /** =================== Valt store handle end ========================== */

  /**
   *
   * @param {string} hostname
   */
  callNotifiedInjetClient(hostname) {
    if (typeof this.notifyInjet === 'function' && hostname) {
      this.notifyInjet(hostname);
    }
  }

  async locked() {
    this.memStore.putState({ Plain: null, items: [] });
  }

  async unlock(SubPriKey) {
    let { chainId } = this.getCurrentProvider() || {};

    if (!chainId || !SubPriKey) {
      throw new BizError('lost chainId or subprikey', INTERNAL_ERROR);
    }

    let Cypher64, Plain;
    try {
      Cypher64 = this.getCypher64();
      if (!Cypher64) {
        const f = InitFile(SubPriKey);
        Plain = f.Plain;
        Cypher64 = f.Cypher64;
        _initChainState.call(this, chainId, Cypher64);
      } else {
        Plain = decryptToPlainTxt(SubPriKey, Cypher64);
      }
      const items = transferTerms(Plain, true);

      if (Plain.unwrap) {
        Plain = Plain.unwrap();
      }
      //update memStore
      this.memStore.updateState({ Plain, items, SubPriKey });

      //notify all
      this.emit('notify:activedTab:communications');
    } catch (error) {
      logger.warn('Decrypted Website Cypher64 to Plain failed.', error);
      throw new BizError('Decrypted Website Cypher64 to Plain failed.', INTERNAL_ERROR);
    }
  }

  async addItem(subKey, data = {}) {
    if (!subKey) throw new BizError('lost subPriKey.', INTERNAL_ERROR);
    if (!data) throw new BizError('lost item data.', INTERNAL_ERROR);

    logger.warn('add website item failed', data);
    const cypher64 = this.getCypher64();
    if (!cypher64) throw new BizError('local cypher lost.', INTERNAL_ERROR);

    const { title, username, password } = data;

    try {
      const f = UpdateCmdAdd(subKey, cypher64, new Term(title, username, password));
      const { Plain, Cypher64 } = f;

      this.updateLocalChainCypher64(Cypher64);

      this.reloadMemStore(Plain, Cypher64);
      // this.emit('notify:injet:client', hostname);

      //notify all
      this.emit('notify:activedTab:communications');
      return await this.getState();
    } catch (error) {
      logger.warn('add website item failed', error);
      throw new BizError(`Title:${title} has been exist.`, VEX_ITEM_EXIST);
    }
  }

  async updateItem(subKey, data) {
    if (!subKey) throw new BizError('lost subPriKey.', INTERNAL_ERROR);
    if (!data) throw new BizError('lost item data.', INTERNAL_ERROR);

    const cypher64 = await this.getCypher64();
    if (!cypher64) throw new BizError('local cypher lost.', INTERNAL_ERROR);

    const { title, username, password } = data;
    try {
      const f = UpdateCmdChange(subKey, cypher64, new Term(title, username, password));
      const { Plain, Cypher64 } = f;

      this.updateLocalChainCypher64(Cypher64);
      await this.reloadMemStore(Plain, Cypher64);

      //notify all
      this.emit('notify:activedTab:communications');

      return await this.getState();
    } catch (err) {
      throw new BizError(`Title ${title} unfound.`, VEX_ITEM_EDIT);
    }
  }

  async deleteItem(subKey, data) {
    if (!subKey) throw new Error('lost subPriKey.');
    if (!data || !data.title) throw new Error('lost item data.');

    const { title } = data;
    const cypher64 = this.getCypher64();
    if (!cypher64) throw new Error('local cypher lost.');

    try {
      const f = UpdateCmdDelete(subKey, cypher64, new Term(title, null, null));

      const { Plain, Cypher64 } = f;

      this.updateLocalChainCypher64(Cypher64);
      await this.reloadMemStore(Plain, Cypher64);
      // this.emit('notify:injet:client', hostname);

      //notify all
      this.emit('notify:activedTab:communications');

      return await this.getState();
    } catch (err) {
      logger.warn(err);
      throw new BizError(`Title ${title} unfound.`, VEX_ITEM_DELETE);
    }
  }

  async reloadMemStore(Plain, cypher64) {
    if (!Plain || !cypher64) {
      return;
    }
    try {
      const items = transferTerms(Plain, true);
      if (typeof Plain.unwrap === 'function') {
        Plain = Plain.unwrap();
      }
      await this.memStore.updateState({ Plain, items });
    } catch (err) {
      logger.warn('reload website memstore failed.', err);
    }
  }

  async getState() {
    const state = await this.memStore.getState();
    const diff = getDiff(state.Plain);

    return {
      ...state,
      diff,
    };
  }

  getCypher64() {
    const { chainId } = this.getCurrentProvider();
    const chainState = this.chainStore.getState() || {};
    const cypher64 = chainState[chainId] && chainState[chainId] ? chainState[chainId] : '';
    return cypher64;
  }

  updateLocalChainCypher64(Cypher64) {
    const { chainId } = this.getCurrentProvider();
    if (!chainId) {
      throw new BizError('lost chainId in currentProvider.', INTERNAL_ERROR);
    }
    this.chainStore.updateState({ [chainId]: Cypher64 });
  }

  updateVersionState(chainId, blockNumber = 0, lastTxHash = '') {
    if (!chainId) {
      throw new BizError('lost chainId.', INTERNAL_ERROR);
    }
    const upState = {
      [chainId]: {
        uts: new Date().getTime(),
        blockNumber,
        lastTxHash,
      },
    };

    this.versionStore.updateState(upState);
  }

  /** notice : this state only send to injet feild-controller */
  async getZombieState(hostname) {
    const state = await this.memStore.getState();
    let items = state.items || [];
    let matchedNum = 0;
    if (hostname && items.length > 0) {
      items = items.filter((it) => hostname.endsWith(it.hostname));
      matchedNum = items.length;
    } else {
      items = [];
    }

    //make password safety don't send to page dom ,it only in leech can get password
    const newItems = deepthCopyItems(items).map((it) => {
      // it.password = 'bp-hidden';
      return it;
    });

    return {
      matchedNum,
      hostname,
      items,
    };
  }

  /**
   * 初始化化 Website Cypher
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
  /* <----------------------- Block Chain methods ----------------------> */
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
    const { blockNumber, lastTxHash, logs = [], evtLogs } = logsResp;

    let retFile = null;
    if (logs.length > 0 && blockNumber > fromBlock) {
      retFile = UpdateBlockData(dev3.SubPriKey, currCypher64, blockNumber, lastTxHash, logs);
      this.reloadMemStore(retFile.Plain, retFile.Cypher64);
      this.updateLocalChainCypher64(retFile.Cypher64);
    }

    return await this.memStore.getState();
  }
}

function deepthCopyItems(items) {
  if (!items || !items.length) return [];
  return JSON.parse(JSON.stringify(items));
}

export default WebsiteController;

/** +++++++++++++++++++++++++ File scope functions +++++++++++++++++++++++++++ */

/**
 *
 * @param {number} chainId
 * @param {string} Cypher64
 */
function _initChainState(chainId, Cypher64) {
  let upChainState = {
    [chainId]: Cypher64,
  };
  this.chainStore.updateState(upChainState);
}

/**
 *
 * @param {number} fromBlock
 */
async function _GetFromChainLogs(selectedAddress, fromBlock = 0) {
  const { chainId, rpcUrl } = this.getCurrentProvider();

  if (!chainId || !rpcUrl || !selectedAddress) {
    throw new BizError('Params illegal', INTERNAL_ERROR);
  }

  logger.debug('Website _GetFromChainLogs>>>>>>>>>>>>', fromBlock);
  const web3js = getWeb3Inst(rpcUrl);
  const respLogs = await fetchEventLogsFromChain(web3js, chainId, selectedAddress, fromBlock);
  return respLogs;
}
