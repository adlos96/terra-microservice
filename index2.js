const express = require('express');
const {
  sendLuna,
  getStakingRewards,
  withdrawRewards,
  delegateLuna,
  redelegateLuna,
  undelegateLuna,
  compoundRewards,
  checkIncomingTransaction
} = require('./terraOperations');

process.removeAllListeners('warning');

const app = express();
app.use(express.json());

// Endpoint per l'invio di LUNA
app.post('/send', async (req, res, next) => {
  const { toAddress, amount, memo } = req.body;
  if (!toAddress || !amount)
    return res.status(400).json({ error: 'toAddress e amount sono obbligatori' });
  
  try {
    const result = await sendLuna(toAddress, amount, memo);
    if (!result.success) {
      return res.status(400).json({
        warning: result.message,
        details: {
          available: result.available,
          requested: result.requested
        }
      });
    }
    res.json(result);

  } catch (err) {
    next(err);
  }
});

// Endpoint per leggere le ricompense di staking
app.get('/staking/rewards', async (req, res, next) => {
  try {
    const rewards = await getStakingRewards();
    res.set('Content-Type', 'text/plain');
    res.send(rewards);
  } catch (err) {
    next(err);
  }
});

// Endpoint per prelevare le ricompense di staking
app.post('/staking/withdraw-rewards', async (req, res, next) => {
  const { validatorAddress } = req.body;
  if (!validatorAddress) 
    return res.status(400).json({ error: 'validatorAddress è obbligatorio' });
  
  try {
    const result = await withdrawRewards(validatorAddress);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Endpoint per delegare LUNA a un validatore
app.post('/staking/delegate', async (req, res, next) => {
  const { validatorAddress, amount } = req.body;
  if (!validatorAddress || !amount)
    return res.status(400).json({ error: 'validatorAddress e amount sono obbligatori' });
  
  try {
    const result = await delegateLuna(validatorAddress, amount);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Endpoint per ridelegare LUNA
app.post('/staking/redelegate', async (req, res, next) => {
  const { srcValidatorAddress, dstValidatorAddress, amount } = req.body;
  if (!srcValidatorAddress || !dstValidatorAddress || !amount)
    return res.status(400).json({ error: 'srcValidatorAddress, dstValidatorAddress e amount sono obbligatori' });
  
  try {
    const result = await redelegateLuna(srcValidatorAddress, dstValidatorAddress, amount);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Endpoint per annullare la delega di LUNA
app.post('/staking/undelegate', async (req, res, next) => {
  const { validatorAddress, amount } = req.body;
  if (!validatorAddress || !amount)
    return res.status(400).json({ error: 'validatorAddress e amount sono obbligatori' });
  
  try {
    const result = await undelegateLuna(validatorAddress, amount);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Endpoint per il compound delle ricompense
app.post('/compound', async (req, res, next) => {
  const { validatorAddress, percentage } = req.body;
  if (!validatorAddress)
    return res.status(400).json({ error: 'validatorAddress è obbligatorio' });
  
  try {
    const result = await compoundRewards(validatorAddress, percentage);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Endpoint per verificare una transazione in entrata tramite memo
app.get('/check-transaction/:memo', async (req, res, next) => {
  const { memo } = req.params;
  const { blocks } = req.query; // opzionale: numero di blocchi da controllare
  
  if (!memo) {
    return res.status(400).json({ error: 'Memo è obbligatoria' });
  }
  
  try {
    const result = await checkIncomingTransaction(memo, blocks ? parseInt(blocks) : 100);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Middleware per gestire i timeout della richiesta
app.use((req, res, next) => {
  req.setTimeout(60000);
  next();
});

// Middleware di errore
app.use((err, req, res, next) => {
  console.error('Errore server:', err.stack || err);
  res.status(500).json({
    error: err.message,
    code: err.response?.data?.code || 'UNKNOWN_ERROR'
  });
});

app.listen(3000, () => console.log('[Terra] Microservizio avanzato in ascolto sulla porta 3000'));