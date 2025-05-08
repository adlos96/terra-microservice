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
async function executeTransaction(msgs, memo) {
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
async function sendLuna(toAddress, amount, memo) {
  const [balance] = await terra.bank.balance(Address_Account);
  const available = balance.get('uluna');
  
  const amountToSend = amount.toString();
  if (!available || BigInt(available.amount) < BigInt(amountToSend)) {
    console.warn('WARNING: Saldo insufficiente per completare la transazione');
    return {
      success: false,
      message: 'Saldo LUNA insufficiente',
      available: available ? available.amount.toString() : '0',
      requested: amountToSend
    };
  }
  const send = new MsgSend(
    Address_Account,
    toAddress,
    new Coins({ uluna: amountToSend })
  );
  
  return executeTransaction([send], memo); // Aggiungi la memo qui
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

async function checkIncomingTransaction(memo, sender, expectedAmount, blockCount = 400) {
  try {
    const latestBlock = await getLatestBlockHeight();
    const fromBlock = latestBlock - blockCount;

    const events = [
      `transfer.recipient='${Address_Protocol}'`
    ];

    const queryString = events.map(e => `events=${encodeURIComponent(e)}`).join('&');
    const url = `https://phoenix-lcd.terra.dev/cosmos/tx/v1beta1/txs?${queryString}&pagination.limit=100`;

    console.log('🔍 Ricerca transazioni:', {
      memo,
      recipient: Address_Protocol,
      sender: sender || 'qualsiasi',
      amount: expectedAmount || 'qualsiasi',
      blocchi: `${fromBlock} - ${latestBlock}`
    });

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();

    if (!data.tx_responses?.length) {
      return {
        success: false,
        message: 'Nessuna transazione trovata',
        searchCriteria: { memo, recipient: Address_Protocol, sender, expectedAmount }
      };
    }

    console.log(`📥 Trovate ${data.tx_responses.length} transazioni totali`);

    const matchingTxs = data.tx_responses.filter(tx => {
      try {
        const txBody = tx.tx?.body;
        const txMsg = txBody?.messages?.[0];
        const txAmount = txMsg?.amount?.[0]?.amount;

        const memoMatches = txBody?.memo === memo;
        const senderMatches = !sender || txMsg?.from_address === sender;
        const amountMatches = !expectedAmount || txAmount === expectedAmount;

        console.log(`📋 Transazione ${tx.txhash.slice(0, 8)}...`, {
          memo: txBody?.memo || '(vuota)',
          sender: txMsg?.from_address,
          amount: txAmount,
          matches: {
            memo: memoMatches ? '✅' : '❌',
            sender: senderMatches ? '✅' : '❌',
            amount: amountMatches ? '✅' : '❌'
          }
        });

        return memoMatches && senderMatches && amountMatches;
      } catch (e) {
        console.error('❌ Errore parsing transazione:', e);
        return false;
      }
    });

    if (matchingTxs.length > 0) {
      console.log(`✅ Trovate ${matchingTxs.length} transazioni corrispondenti`);
      return {
        success: true,
        count: matchingTxs.length,
        transactions: matchingTxs.map(tx => ({
          hash: tx.txhash,
          height: tx.height,
          timestamp: tx.timestamp,
          memo: tx.tx?.body?.memo,
          sender: tx.tx?.body?.messages?.[0]?.from_address,
          amount: tx.tx?.body?.messages?.[0]?.amount?.[0],
          gasUsed: tx.gas_used,
          gasWanted: tx.gas_wanted
        }))
      };
    }

    return {
      success: false,
      message: 'Nessuna transazione corrispondente ai criteri',
      searchCriteria: {
        memo,
        recipient: Address_Protocol,
        sender,
        expectedAmount,
        blockRange: `${fromBlock}-${latestBlock}`
      }
    };

  } catch (err) {
    console.error('🔥 Errore:', err);
    throw err;
  }
}

async function getLatestBlockHeight() {
  try {
    const res = await fetch('https://phoenix-lcd.terra.dev/blocks/latest');
    const data = await res.json();
    
    if (data?.block?.header?.height) {
      const height = parseInt(data.block.header.height);
      console.log('Ultimo blocco:', height);
      return height;
    }

    throw new Error('Struttura del blocco non valida');
  } catch (err) {
    console.error('Errore nel recupero del blocco:', err);
    throw new Error('Impossibile ottenere l\'altezza del blocco: ' + err.message);
  }
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