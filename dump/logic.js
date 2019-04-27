/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/**
 * create product package by famer
 * @param {kigen.transactions.CreatePackageTransaction} createTransaction
 * @transaction
 */
async function createTransaction(createTransaction) {
    let factory = getFactory();  

    let assetRegistry = await getAssetRegistry('kigen.assets.ProductPackage');
    // let existingAssets = await assetRegistry.getAll();
  
    // let numberOfAssets = 0;
    // await existingAssets .forEach(function (asset) {
    //   numberOfAssets ++;
    // });

    // let newAssetId =  numberOfAssets +1;
    
    let productPack = factory.newResource('kigen.assets', 'ProductPackage', createTransaction.productPackId);
    // create package property
    productPack.productSerial = createTransaction.productSerial;
    productPack.packageHash = hash(createTransaction.productPackId + createTransaction.productSerial);
    productPack.unitPrice = createTransaction.unitPrice;
    productPack.createDate = createTransaction.createDate;
    productPack.productStatus = createTransaction.productStatus;
    productPack.farmId = createTransaction.farmId;
    productPack.imgLink = createTransaction.imgLink;
    productPack.farmer = factory.newRelationship('kigen.participants', 'Farmer', createTransaction.farmer.getIdentifier());
    productPack.productHolder = factory.newRelationship('kigen.participants', 'Farmer', createTransaction.farmer.getIdentifier());

    const createEvent = getFactory().newEvent('kigen.transactions', 'CreatePackageEvent');
    createEvent.productPackId = createTransaction.productPackId;
    createEvent.farmerId = createTransaction.farmer.getIdentifier();
    createEvent.productSerial = createTransaction.productSerial;
    createEvent.unitPrice = productPack.unitPrice;
    createEvent.productStatus = productPack.productStatus;
    createEvent.imgLink = productPack.imgLink;
    createEvent.farmId = productPack.farmId;
    emit(createEvent);

    await assetRegistry.add(productPack)
}

/**
 * Package has been transferred by an actor in the chain
 * @param {kigen.transactions.TransferTransaction} transferTransaction
 * @transaction
 */
async function transfer(transferTransaction) {
    // set the new holder of product
    transferTransaction.product.productHolder = transferTransaction.newHolder;
    let assetRegistry = await getAssetRegistry('kigen.assets.ProductPackage');

    //emit event
    const transferEvent = getFactory().newEvent('kigen.transactions', 'TransferEvent');
    transferEvent.productPackId = transferTransaction.product.productPackId;
    transferEvent.fromId = getCurrentParticipant().getIdentifier();
    transferEvent.toId = transferTransaction.newHolder.getIdentifier();
    transferEvent.imgLink = transferTransaction.imgLink
    transferEvent.type = transferTransaction.type
    emit(transferEvent);
    
    await assetRegistry.update(transferTransaction.product);
}

/**
 * Package has been transferred by an actor in the chain
 * @param {kigen.transactions.GetHistoryTransaction} getHistoryTransaction
 * @transaction
 */
async function getHistory(getHistoryTransaction) {
    const id = getHistoryTransaction.productPackId;

    const nativeKey = getNativeAPI().createCompositeKey('Asset:kigen.assets.ProductPackage', [id]);
    const iterator = await getNativeAPI().getHistoryForKey(nativeKey);
    let results = [];
    let res = {done : false};
    while (!res.done) {
        res = await iterator.next();
      	console.log('@debug test res', res.value.tx_id);
        if (res && res.value && res.value.value) {
            let val = res.value.value.toString('utf8');
            if (val.length > 0) {
                results.push(val);
              	results.push(res.value.tx_id);
            }
        }
        if (res && res.done) {
            try {
                iterator.close();
            }
            catch (err) {
            }
        }
    }
  	const event = getFactory().newEvent('kigen.transactions', 'GetHistoryTransactionResults');
    event.results = results;
    emit(event);
}


let hash = function(s) {
    var a = 1, c = 0, h, o;
    if (s) {
        a = 0;
        /*jshint plusplus:false bitwise:false*/
        for (h = s.length - 1; h >= 0; h--) {
            o = s.charCodeAt(h);
            a = (a<<6&268435455) + o + (o<<14);
            c = a & 266338304;
            a = c!==0?a^c>>21:a;
        }
    }
    return String(a);
};