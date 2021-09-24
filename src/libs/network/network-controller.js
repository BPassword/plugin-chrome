import { debounce } from 'lodash';
import EventEmitter from 'events';
import ObservableStore from 'obs-store';
import ComposedStore from 'obs-store/lib/composed';

import Web3 from 'web3';

import logger from '../logger';
import BizError from '../biz-error';
import { LOG_LEVEL } from '../code-settings';

import { getWeb3Inst } from '../web3/web3-helpers';

import { INTERNAL_ERROR, NETWORK_UNAVAILABLE, NETWORK_TIMEOUT } from '../biz-error/error-codes';

import {
  ROPSTEN,
  ROPSTEN_CHAIN_ID,
  PROVIDER_TYPE_CUSTOM,
  CUSTOM_DEFAULT,
  NETWORK_TYPE_NAME_KV,
  PROVIDER_TYPE_INFURA,
  findNetworkByChainId,
} from './enums';

import { buildTSLRpcURL } from './infura-helper';

/*********************************************************************
 * AircraftClass :: Migeration From firefox
 *    @description:
 *    @description:
 * WARNINGS:
 *
 * HISTORY:
 *    @author: lanbery@gmail.com
 *    @created:  2020-12-28
 *    @comments:
 **********************************************************************/

const DEFAULT_PROVIDER = {
  providerType: PROVIDER_TYPE_CUSTOM,
  type: CUSTOM_DEFAULT,
  rpcUrl: 'http://localhost:7545',
  chainId: 0x1691,
  nickname: 'Custom 7545',
  color: 'rgba(111, 160, 239,.9)',
};

const DEF_ENABLED_CUSTOMIZE = LOG_LEVEL === 'DEBUG';

class NetworkController extends EventEmitter {
  constructor(opts = {}) {
    super();
    const initState = opts.initState || {};

    let {
      provider,
      custom = DEFAULT_PROVIDER,
      enabledCustomize = DEF_ENABLED_CUSTOMIZE,
    } = initState;

    if (!provider) {
      provider = buildDefaultCurrentProvider();
    }

    this.customzieStore = new ObservableStore(enabledCustomize);
    this.customStore = new ObservableStore(custom);
    this.providerStore = new ObservableStore(provider);

    /**
     * networkStore mark network status
     * loading,ropsten,mainnet,private[custom]
     */
    this.networkStore = new ObservableStore('loading');

    this.store = new ComposedStore({
      enabledCustomize: this.customzieStore,
      provider: this.providerStore,
      custom: this.customStore,
      network: this.networkStore,
    });

    /** Listeners */
    this.setMaxListeners(1);
    this.on('network:ping:noerror', this.pingNetwork.bind(this));

    this.on('network:registed:web3:inst4debug', debounce(_initWeb3GlobalForDebug.bind(this), 1000));
  }

  /** ----------------- Public Methods -------------------- */
  /**
   *
   * @param {object} network,
   *
   */
  async changedNetwork(network) {
    logger.debug(`NetworkController::changedNetwork>>>`, network);

    if (typeof network !== 'object') {
      throw new BizError('Network Params illegal', INTERNAL_ERROR);
    }

    const { chainId, nickname, providerType } = network;
    if (!providerType) {
      new BizError('Network Params providerType illegal', INTERNAL_ERROR);
    }

    let _provider;
    if (providerType === PROVIDER_TYPE_CUSTOM) {
      _provider = this.customStore.getState();

      if (_provider) {
        _provider.providerType = PROVIDER_TYPE_CUSTOM;
      }
    } else if (providerType === PROVIDER_TYPE_INFURA) {
      const nw = findNetworkByChainId(chainId);
      if (nw) {
        _provider = {
          ...nw,
          providerType: PROVIDER_TYPE_INFURA,
          rpcUrl: buildTSLRpcURL({ network: nw.type }),
        };
      }
    } else {
      throw new BizError(`Unsupport network:${nickname}`, NETWORK_UNAVAILABLE);
    }

    try {
      const { rpcUrl } = _provider;
      const web3js = getWeb3Inst(rpcUrl);
      const chainId = await web3js.eth.getChainId();
      const networkType = await web3js.eth.net.getNetworkType();
      _provider.chainId = chainId;
      _provider.type = networkType;

      this.providerStore.updateState(_provider);
      this.networkStore.putState(networkType);

      this.emit('network:registed:web3:inst4debug');
      return this.getSendState();
    } catch (err) {
      logger.warn('Changed network failed', err.message);
      throw new BizError(`RPC provider ${_provider.type} connected fail.`, NETWORK_TIMEOUT);
    }
  }

  getCurrentProvider() {
    const provider = this.providerStore.getState();
    return provider;
  }

  async pingNetwork() {
    try {
      const { provider } = this.store.getState();
      const web3 = new Web3(new Web3.providers.HttpProvider(provider.rpcUrl));
      const chainId = await web3.eth.getChainId();
      const networkType = await web3.eth.net.getNetworkType();
      this.providerStore.updateState({ type: networkType, chainId });
      this.networkStore.putState(networkType);

      this.emit('network:registed:web3:inst4debug');
    } catch (error) {
      logger.warn('Ping network failed.', error.message);
    }
  }

  /**
   * Send UI initState
   */
  getSendState() {
    const { enabledCustomize = false, provider } = this.store.getState();
    let networks = [];
    networks = networks.concat(Object.values(NETWORK_TYPE_NAME_KV));

    if (enabledCustomize) {
      const custom = this.customStore.getState();
      networks = networks.concat(custom);
    }

    networks = networks.map((n) => {
      const id = `${n.providerType || PROVIDER_TYPE_INFURA}-${parseInt(n.chainId)}`;

      return {
        id,
        providerType: n.providerType || PROVIDER_TYPE_INFURA,
        type: n.type,
        name: n.name,
        nickname: n.nickname,
        chainId: n.chainId,
        color: n.color,
        disabled: n.disabled,
      };
    });

    const sendState = {
      chainId: provider?.chainId || ROPSTEN_CHAIN_ID,
      rpcUrl: provider?.rpcUrl || '',
      enabledCustomize,
      networkType: provider?.type,
      networks,
    };

    return sendState;
  }
}

export function buildDefaultCurrentProvider() {
  const rpcUrl = buildTSLRpcURL({ network: ROPSTEN });
  const ropstenNetwork = NETWORK_TYPE_NAME_KV[ROPSTEN];

  return {
    providerType: PROVIDER_TYPE_INFURA,
    ...ropstenNetwork,
    rpcUrl,
  };
}

async function _initWeb3GlobalForDebug() {
  const { rpcUrl } = this.providerStore.getState();
  if (LOG_LEVEL === 'DEBUG' && rpcUrl) {
    global.web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
  }
}

export default NetworkController;
