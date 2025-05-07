const fs = require('fs');
const fetch = require('node-fetch');
const { 
  LCDClient, 
  MnemonicKey, 
  MsgSend, 
  MsgDelegate,
  MsgWithdrawDelegatorReward,
  MsgBeginRedelegate,
  MsgUndelegate,
  Coins 
} = require('@terra-money/feather.js');

// Lettura sicura della mnemonica e setup del client
const mnemonic = fs.readFileSync('mnemonic.txt', 'utf8').trim();
const mk = new MnemonicKey({ mnemonic });
if (!mk.publicKey)
  throw new Error('Mnemonica invalida: publicKey non generata');

const terra = new LCDClient({
  'phoenix-1': {
    chainID: 'phoenix-1',
    lcd: 'https://terra-rest.publicnode.com',
    prefix: 'terra',
    gasPrices: { uluna: 0.015 },
    gasAdjustment: 1.75
  }
});

const wallet = terra.wallet(mk);
const Address_Account = wallet.key.accAddress('terra'); //Wallet per inviare le transazioni derivato dalla mnemonica
const Address_Protocol = "terra1wyud5dzdaawnj2q53xcjgslrfal44dfx2w0ms3"; //Wallet con lo staking
console.log('Indirizzo del portafoglio:', Address_Account);

// Funzione di utility per la gestione delle transazioni
async function executeTransaction(msgs, memo, address) {
  try {
    const fee = await terra.tx.estimateFee(
      [{
        sequenceNumber: (await terra.auth.accountInfo(Address_Account)).sequence,
        publicKey: wallet.key.publicKey
      }],
      {
        msgs: msgs,
        gasAdjustment: 1.75,
        gasPrices: { uluna: 0.015 },
        chainID: 'phoenix-1'
      }
    );
    console.log('Fee stimate:', fee.amount.toString());
    console.log('Public key:', wallet.key.publicKey.key.toString());
    
    const tx = await wallet.createAndSignTx({
      msgs: msgs,
      fee: fee,
      chainID: 'phoenix-1',
      memo: memo
    });

    console.log('Trasmissione della transazione...');
    const result = await terra.tx.broadcast(tx, 'phoenix-1');
    console.log('Risultato della transazione:', result);

    return {
      txhash: result.txhash,
      success: true,
      raw_log: result.raw_log || result.rawLog
    };
  } catch (err) {
    console.error('Errore nella transazione:', err);
    throw err;
  }
}

// Funzioni operative
async function sendLuna(toAddress, amount) {
  const [balance] = await terra.bank.balance(Address_Account);
  const available = balance.get('uluna');
  
  const amountToSend = amount.toString();
  if (!available || BigInt(available.amount) < BigInt(amountToSend)) {
    console.warn('WARNING: Saldo insufficiente per completare la transazione');
    return {
      success: false,
      message: 'Saldo insufficiente per completare la transazione',
      available: available ? available.amount.toString() : '0',
      requested: amountToSend
    };
  }
  const send = new MsgSend(
    Address_Account,
    toAddress,
    new Coins({ uluna: amountToSend })
  );
  
  return executeTransaction([send]);
}

async function getStakingRewards() {
  const delegationsResponse = await terra.staking.delegations(Address_Protocol);
  const rewards = await terra.distribution.rewards(Address_Protocol);
  
  if (!rewards || !rewards.rewards) {
    throw new Error('Nessun reward disponibile');
  }
  
  let responseStrings = [];
  for (const [validatorAddress, rewardValue] of Object.entries(rewards.rewards)) {
    try {
      let amount = rewardValue;
      if (typeof rewardValue === 'string') {
        try {
          const parsedReward = JSON.parse(rewardValue);
          if (Array.isArray(parsedReward) && parsedReward[0]?.amount) {
            amount = parsedReward[0].amount;
          }
        } catch (parseErr) {
          console.error('Errore parsing reward:', parseErr);
        }
      }
      responseStrings.push(`Validatore: ${validatorAddress}, Totale: ${amount}`);
    } catch (err) {
      console.error('Errore durante la formattazione della risposta:', err);
    }
  }
  
  return responseStrings.join('\n');
}

async function withdrawRewards(validatorAddress) {
  const withdrawMsg = new MsgWithdrawDelegatorReward(
    Address_Account,
    validatorAddress
  );
  return executeTransaction([withdrawMsg]);
}

async function delegateLuna(validatorAddress, amount) {
  const [balance] = await terra.bank.balance(Address_Account);
  const available = balance.get('uluna');
  
  const amountToDelegate = amount.toString();
  if (!available || BigInt(available.amount) < BigInt(amountToDelegate))
    throw new Error('Saldo insufficiente per completare la delega');
  
  const delegateMsg = new MsgDelegate(
    Address_Account,
    validatorAddress,
    { uluna: amountToDelegate }
  );
  
  return executeTransaction([delegateMsg]);
}

async function redelegateLuna(srcValidatorAddress, dstValidatorAddress, amount) {
  const redelegateMsg = new MsgBeginRedelegate(
    Address_Account,
    srcValidatorAddress,
    dstValidatorAddress,
    { uluna: amount.toString() }
  );
  
  return executeTransaction([redelegateMsg]);
}

async function undelegateLuna(validatorAddress, amount) {
  const undelegateMsg = new MsgUndelegate(
    Address_Account,
    validatorAddress,
    { uluna: amount.toString() }
  );
  
  return executeTransaction([undelegateMsg]);
}

async function compoundRewards(validatorAddress, percentage = 80) {
  const rewards = await terra.distribution.rewards(Address_Account);
  const validatorRewards = rewards.rewards.find(
    reward => reward.validator_address === validatorAddress
  );
  
  if (!validatorRewards || !validatorRewards.reward.get('uluna'))
    throw new Error('Nessuna ricompensa disponibile per questo validatore');
  
  const rewardAmount = validatorRewards.reward.get('uluna').amount;
  const amountToDelegate = Math.floor(Number(rewardAmount) * percentage / 100).toString();
  
  if (Number(amountToDelegate) <= 0)
    throw new Error('Importo della ricompensa troppo basso per delegare');
  
  const withdrawMsg = new MsgWithdrawDelegatorReward(
    myAddress,
    validatorAddress
  );
  
  const delegateMsg = new MsgDelegate(
    myAddress,
    validatorAddress,
    { uluna: amountToDelegate }
  );
  
  return executeTransaction([withdrawMsg, delegateMsg], 'Compound rewards');
}

async function checkIncomingTransaction(memo, blockCount = 100) {
  try {
    const events = [
      `message.sender='${Address_Account}'`,
      `message.action='/cosmos.bank.v1beta1.MsgSend'`,
      `transfer.recipient='${Address_Protocol}'`
    ].map(e => `events=${encodeURIComponent(e)}`).join('&');

    const url = `https://phoenix-lcd.terra.dev/cosmos/tx/v1beta1/txs?${events}&pagination.limit=20&order_by=ORDER_BY_DESC`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    console.log('Risposta ricerca tx:', JSON.stringify(data, null, 2));

    if (!data || !data.tx_responses || data.tx_responses.length === 0) {
      return {
        success: false,
        message: `Nessuna transazione trovata per l'indirizzo ${Address_Protocol}`,
        details: {
          searchedMemo: memo,
          recipient: Address_Protocol,
          totalTransactions: 0
        }
      };
    }

    if (data && data.tx_responses && data.tx_responses.length > 0) {
      // Find transaction with matching memo
      const tx = data.tx_responses.find(tx => {
        try {
          const txData = JSON.parse(tx.tx);
          return txData.body.memo === memo;
        } catch (e) {
          console.error('Errore parsing tx:', e);
          return false;
        }
      });

      if (tx) {
        return {
          success: true,
          height: tx.height,
          txHash: tx.txhash,
          sender: tx.tx.body.messages[0].from_address,
          amount: tx.tx.body.messages[0].amount,
          memo: memo,
          timestamp: tx.timestamp
        };
      }
    }

    return {
      success: false,
      message: 'Nessuna transazione trovata con la memo specificata'
    };
  } catch (err) {
    console.error('Errore nella ricerca della transazione:', err);
    throw err;
  }
}

async function getLatestBlockHeight() {
  const res = await fetch('https://phoenix-lcd.terra.dev/blocks/latest');
  const data = await res.json();
  console.log('Risposta blocco:', JSON.stringify(data, null, 2));

  if (data && data.block && data.block.header && data.block.header.height) {
    return parseInt(data.block.header.height);
  }
  throw new Error('Impossibile ottenere il blocco più recente: struttura dati inattesa');
}

module.exports = {
  sendLuna,
  getStakingRewards,
  withdrawRewards,
  delegateLuna,
  redelegateLuna,
  undelegateLuna,
  compoundRewards,
  checkIncomingTransaction,
  getLatestBlockHeight
};