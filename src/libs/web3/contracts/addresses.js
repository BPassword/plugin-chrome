/*********************************************************************
 * AircraftClass ::
 *    @description: mainnet
 *      0x8A91F4b3A1249Cb29ee0b80B2CDF57EbfbD53b07 - bptStorageByEvent
 *      0xA3CFebAB3c2fCdAC18b2921Cb6E1c248DA53B438 - bptStorageByEvent-new
 *    @description: ropsten app
 *      0x4458F6813Cd8d7dc56A7c5729Bd5B0b2F7b7720d - BT
 *      0x734B9833b0B57e249C1DD338aEaD86a45674d9d1 - bptMember
 *      0xB574E1611dBC27Ae4123cCfa1C1954AA86F4676E - bptStorageByEvent
 *      0x9b9688211D4f74D706a6250F89d1214846Da0291 - bptStorageByEvent-new
 *
 *    @description: Ropsten lan
 *      0xa492CcF60d4fB5380d14BC7fFeef08f1b26059d1 - BT
 *      0x1f2dfec2aafd7e668910c34b86dd31eb6ede4737 - bptMember
 *      0x8a92eb3de19bd9d9265e725eaf6744fa131f3985 - bptStorageByEvent
 *
 * WARNINGS:
 *
 * HISTORY:
 *    @author: lanbery@gmail.com
 *    @created:  2020-12-18
 *    @comments:
 **********************************************************************/
const smarts = {
  3: [
    {
      contractName: 'BT',
      address: '0x61b10e58396D03C303dE54dBc8B3c8eef7f3b2d5',
    },
    {
      contractName: 'Admin',
      address: '0x4f6fa3aab92155fcb731e7af8f45ec202e20b097',
    },
    {
      contractName: 'bptMember',
      address: '0xF012469c45941dF41ddd9b2233d6eDd306244D88',
    },
    {
      contractName: 'bptStorage',
      address: '0xF012469c45941dF41ddd9b2233d6eDd306244D88',
    },
    {
      contractName: 'bptStorageByEvent',
      address: '0xaecE56330409dC3a2597a69D1b3573CF0a69e74f',
    },
    {
      contractName: 'bptStorageByEventSite',
      address: '0xb383Ac83940B1527F86ACB5d6458baEcD59eFf45',
    },
  ],
  1: [
    {
      contractName: 'BT',
      address: '0xBC52a198619553fc1A0F925bB5B2E6EfaA9e45F1',
    },
    {
      contractName: 'Admin',
      address: '',
    },
    {
      contractName: 'bptMember',
      address: '0xa691571A54eE924855753e0eeA07db78840a81B7',
    },
    {
      contractName: 'bptStorage',
      address: '0xa691571A54eE924855753e0eeA07db78840a81B7',
    },
    {
      contractName: 'bptStorageByEvent',
      address: '0x8A91F4b3A1249Cb29ee0b80B2CDF57EbfbD53b07',
    },
    {
      contractName: 'bptStorageByEventSite',
      address: '0xA3CFebAB3c2fCdAC18b2921Cb6E1c248DA53B438',
    },
  ],
  97: [
    {
      contractName: 'BT',
      address: '0x43f07Fb1B26B0b891055f8d68509E17E8581B92c',
    },
    {
      contractName: 'Admin',
      address: '0xFd30d2c32E6A22c2f026225f1cEeA72bFD9De865',
    },
    {
      contractName: 'bptMember',
      address: '0xDEeF52e1c6Da66Fd2E78FFC03fBD86bfB6b4bE76',
    },
    {
      contractName: 'bptStorage',
      address: '0xDEeF52e1c6Da66Fd2E78FFC03fBD86bfB6b4bE76',
    },
    {
      contractName: 'bptStorageByEvent',
      address: '0xb1305e836CA0DF69c66a025cF86dFDF64714A0D1',
    },
    {
      contractName: 'bptStorageByEventSite',
      address: '0x789B6786a86a342F17bdAf42E004bb8C9704d632',
    },
  ],
};

export default smarts;
