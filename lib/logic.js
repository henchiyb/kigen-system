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

    let productPack = factory.newResource('kigen.assets', 'ProductPackage', createTransaction.productPackId);
    // create package property
    productPack.productSerial = createTransaction.productSerial;
    productPack.packageHash = hash(createTransaction.productPackId + createTransaction.productSerial);
    productPack.unitPrice = createTransaction.unitPrice;
    productPack.createDate = createTransaction.createDate;
    productPack.farmer = factory.newRelationship('kigen.participants', 'Farmer', createTransaction.farmer.getIdentifier());
    productPack.productHolder = factory.newRelationship('kigen.participants', 'Farmer', createTransaction.farmer.getIdentifier());

    //emit event
    const createEvent = getFactory().newEvent('kigen.transactions', 'CreatePackageEvent');
    createEvent.productPackId = createTransaction.productPackId;
    createEvent.farmerId = createTransaction.farmer.getIdentifier();
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
    const transferEvent = getFactory().newEvent('kigen.transaction', 'TransferEvent');
    transferEvent.productPackId = transferTransaction.product.productPackId;
    transferEvent.fromId = getCurrentParticipant().getIdentifier();
    transferEvent.toId = transferTransaction.newHolder.getIdentifier();
    emit(transferEvent);
    
    await assetRegistry.update(transferTransaction.product);
}

/**
 * product has been received by a party in the chain
 * @param {kigen.transactions.Reception} reception
 * @transaction
 */
async function receive(reception) {
    let factory = getFactory();

    //verify metadata by checking hash attribute and the invoking participant
    let checkHash = hash(reception.productPackId + reception.productSerial);
    let assetRegistry = await getAssetRegistry('kigen.assets.ProductPackage');
    let asset = await assetRegistry.get(reception.productPackId);

    let invoker = getCurrentParticipant().getIdentifier();

    if (asset.productHolder.getIdentifier() !== invoker) {
        throw new Error('Invoking party is not the designated owner of the asset!');
    } else if (asset.quarantinePlacement != null) {
        throw new Error('Asset was already placed in quarantine!');
    } else if (asset.productHash !== checkHash) {
        let quarantine = factory.newConcept('kigen.assets', 'QuarantinePlacement');
        quarantine.start = reception.timestamp;
        quarantine.reason = 'provided data do not match with hash!';
        asset.quarantinePlacement = quarantine;

        //emit quarantine event
        const receptionEvent = getFactory().newEvent('kigen.transaction', 'ReceptionEvent');
        let checkHash = hash(reception.productPackId + reception.productSerial);
        receptionEvent.productPackId = reception.productPackId;
        receptionEvent.actorId = getCurrentParticipant().getIdentifier();
        receptionEvent.succes = false;
        emit(receptionEvent);

        await assetRegistry.update(asset);
    } else {
        //emit succes event
        const receptionEvent = getFactory().newEvent('kigen.transaction', 'ReceptionEvent');
        receptionEvent.productPackId = reception.productPackId;
        receptionEvent.actorId = getCurrentParticipant().getIdentifier();
        receptionEvent.succes = true;
        emit(receptionEvent);
    }
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