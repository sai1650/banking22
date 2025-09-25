/* ---------------------------------------
   Patterns demo: Observer, Strategy, Command
   Plain JS / ES6 — single-file logic for demo
   --------------------------------------- */

/* ========== Utility ========== */
const $ = (id) => document.getElementById(id);
const now = () => new Date().toLocaleTimeString();

/* ========== Observer Pattern ==========
   Subject = AccountSubject (per account)
   Observers = Customer (subscribed to account)
   When balance changes -> notify observers
======================================== */

class AccountSubject {
  constructor(account) {
    this.account = account;
    this.observers = []; // list of functions or observer objects
  }
  attach(observer) {
    this.observers.push(observer);
    updateObserverStat();
  }
  detach(observerEmail) {
    this.observers = this.observers.filter(o => o.email !== observerEmail);
    updateObserverStat();
  }
  notify(message) {
    this.observers.forEach(obs => {
      obs.update(this.account, message);
    });
  }
}

class CustomerObserver {
  constructor(name, email, feedEl) {
    this.name = name;
    this.email = email;
    this.feedEl = feedEl;
  }
  update(account, message) {
    // Push to notifications feed
    addNotification(`${this.name} (${this.email}) — ${account.owner}`, message);
  }
}

/* ========== Strategy Pattern ==========
   InterestStrategy: savings, fixed, current
   calculate(balance) returns interest amount (demo simplified)
======================================== */

class InterestStrategy {
  calculate(balance) { return 0; }
}

class SavingsInterest extends InterestStrategy {
  calculate(balance) { return balance * 0.04; } // 4%
}
class FixedInterest extends InterestStrategy {
  calculate(balance) { return balance * 0.07; } // 7%
}
class CurrentInterest extends InterestStrategy {
  calculate(balance) { return balance * 0.005; } // 0.5%
}

/* ========== Account (Receiver) ========== */
class Account {
  constructor(id, owner, type, balance=0) {
    this.id = id;
    this.owner = owner;
    this.type = type; // 'savings'|'fixed'|'current'
    this.balance = Number(balance);
    this.subject = new AccountSubject(this);
    this.subscribers = []; // store observer emails for UI
  }

  deposit(amount) {
    if (amount <= 0) throw new Error("Amount must be > 0");
    this.balance += amount;
    this.subject.notify(`₹${amount.toFixed(2)} deposited. New balance: ₹${this.balance.toFixed(2)}`);
  }

  withdraw(amount) {
    if (amount <= 0) throw new Error("Amount must be > 0");
    if (amount > this.balance) throw new Error("Insufficient funds");
    this.balance -= amount;
    this.subject.notify(`₹${amount.toFixed(2)} withdrawn. New balance: ₹${this.balance.toFixed(2)}`);
  }

  transferTo(targetAccount, amount) {
    if (this.id === targetAccount.id) throw new Error("Cannot transfer to same account");
    this.withdraw(amount);
    targetAccount.deposit(amount);
    // Notify both
    this.subject.notify(`Transferred ₹${amount.toFixed(2)} to ${targetAccount.owner} (Acc:${targetAccount.id})`);
    targetAccount.subject.notify(`Received ₹${amount.toFixed(2)} from ${this.owner} (Acc:${this.id})`);
  }

  applyInterest(strategy) {
    const interest = strategy.calculate(this.balance);
    this.balance += interest;
    this.subject.notify(`Interest applied: ₹${interest.toFixed(2)}. New balance: ₹${this.balance.toFixed(2)}`);
  }
}

/* ========== Command Pattern ==========
   Command interface: execute(), undo()
   Concrete commands: DepositCommand, WithdrawCommand, TransferCommand
======================================== */

class Command {
  execute(){ throw "execute() not implemented"; }
  undo(){ throw "undo() not implemented"; }
}

class DepositCommand extends Command {
  constructor(account, amount) {
    super();
    this.account = account;
    this.amount = amount;
  }
  execute() {
    this.account.deposit(this.amount);
  }
  undo() {
    // reverse deposit => withdraw
    this.account.withdraw(this.amount);
    addNotification("System", `Undo: Deposited ₹${this.amount.toFixed(2)} removed from ${this.account.owner}`);
  }
}

class WithdrawCommand extends Command {
  constructor(account, amount) {
    super();
    this.account = account;
    this.amount = amount;
  }
  execute() {
    this.account.withdraw(this.amount);
  }
  undo() {
    // reverse withdraw => deposit
    this.account.deposit(this.amount);
    addNotification("System", `Undo: Withdraw ₹${this.amount.toFixed(2)} returned to ${this.account.owner}`);
  }
}

class TransferCommand extends Command {
  constructor(fromAcc, toAcc, amount) {
    super();
    this.fromAcc = fromAcc;
    this.toAcc = toAcc;
    this.amount = amount;
  }
  execute() {
    this.fromAcc.transferTo(this.toAcc, this.amount);
  }
  undo() {
    // reverse transfer: withdraw from recipient and deposit back
    this.toAcc.withdraw(this.amount);
    this.fromAcc.deposit(this.amount);
    addNotification("System", `Undo: Transfer of ₹${this.amount.toFixed(2)} reversed between ${this.fromAcc.owner} & ${this.toAcc.owner}`);
  }
}

/* ========== App State ========== */
const accounts = new Map(); // id -> Account
const commandStack = []; // history of executed commands (for undo)
let nextAcctId = 1001;

/* ========== UI Helpers ========== */
function addNotification(title, message) {
  const feed = $('notifications-feed');
  const item = document.createElement('div');
  item.className = 'item';
  item.innerHTML = `<div style="min-width:36px"><i class="fas fa-bell"></i></div>
    <div style="flex:1">
      <div style="font-weight:700">${title} <span class="time">• ${now()}</span></div>
      <div style="color:var(--muted);font-size:0.95rem">${message}</div>
    </div>`;
  feed.prepend(item);
  // small toast animation at top of middle panel
  showToast(`${title}: ${message}`);
}

function showToast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(()=> el.remove(), 3000);
}

function updateObserverStat() {
  // count total observers across accounts
  let count = 0;
  accounts.forEach(a => count += a.subject.observers.length);
  $('stat-observers').textContent = count;
}

/* ========== Rendering ========== */

function renderAccountsList() {
  const container = $('accounts-list');
  const fromSelect = $('from-account');
  const toSelect = $('to-account');
  const interestSelect = $('interest-account');

  container.innerHTML = '';
  fromSelect.innerHTML = '';
  toSelect.innerHTML = '';
  interestSelect.innerHTML = '';

  if (accounts.size === 0) {
    container.innerHTML = `<div class="empty">No accounts yet — create one ✨</div>`;
    fromSelect.innerHTML = `<option value="">— none —</option>`;
    toSelect.innerHTML = `<option value="">— none —</option>`;
    interestSelect.innerHTML = `<option value="">— none —</option>`;
    return;
  }

  accounts.forEach((acct, id) => {
    const div = document.createElement('div');
    div.className = 'acct-card';
    div.innerHTML = `<div class="acct-meta">
        <div style="display:flex;gap:8px;align-items:center"><strong>${acct.owner}</strong><small style="color:var(--muted)">(${acct.type})</small></div>
        <small class="muted">Acc #: ${acct.id}</small>
      </div>
      <div style="text-align:right">
        <div class="badge">₹ ${acct.balance.toFixed(2)}</div>
        <div style="font-size:0.8rem;color:var(--muted);margin-top:6px">${acct.subject.observers.length} observers</div>
      </div>`;

    div.onclick = () => showAccountDetails(acct);
    container.appendChild(div);

    // select options
    const opt1 = document.createElement('option');
    opt1.value = acct.id; opt1.text = `${acct.owner} — ${acct.id}`;
    fromSelect.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = acct.id; opt2.text = `${acct.owner} — ${acct.id}`;
    toSelect.appendChild(opt2);

    const opt3 = document.createElement('option');
    opt3.value = acct.id; opt3.text = `${acct.owner} — ${acct.id}`;
    interestSelect.appendChild(opt3);
  });
}

function showAccountDetails(acct) {
  const details = $('acct-details');
  details.innerHTML = `
    <div class="acct-info">
      <div><strong>${acct.owner}</strong> <small style="color:var(--muted)">(${acct.type})</small></div>
      <div><strong>Acc #:</strong> ${acct.id}</div>
      <div><strong>Balance:</strong> ₹ ${acct.balance.toFixed(2)}</div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:8px">
        <input id="subscribe-email" placeholder="Observer email (to subscribe)" style="flex:1;padding:8px;border-radius:8px;background:transparent;border:1px solid rgba(255,255,255,0.03)" />
        <button class="btn small primary" id="subscribe-btn">Subscribe</button>
      </div>
      <div id="sub-list" style="margin-top:8px">
        <strong>Observers:</strong>
        <div id="obs-list" style="margin-top:6px;color:var(--muted)"></div>
      </div>
    </div>
  `;

  // fill observer list
  const obsList = $('obs-list');
  obsList.innerHTML = '';
  acct.subject.observers.forEach(o => {
    const line = document.createElement('div');
    line.style.display = 'flex';
    line.style.justifyContent = 'space-between';
    line.style.alignItems = 'center';
    line.style.marginBottom = '6px';
    line.innerHTML = `<div>${o.name} <small style="color:var(--muted)">(${o.email})</small></div>
                      <button class="btn small neutral" data-email="${o.email}">Unsub</button>`;
    obsList.appendChild(line);

    line.querySelector('button').onclick = (ev) => {
      acct.subject.detach(o.email);
      renderAccountsList();
      showAccountDetails(acct);
    };
  });

  $('subscribe-btn').onclick = () => {
    const email = $('subscribe-email').value.trim();
    if (!email) { showToast('Enter email'); return; }
    const name = email.split('@')[0];
    const observer = new CustomerObserver(name, email, $('notifications-feed'));
    acct.subject.attach(observer);
    renderAccountsList();
    showAccountDetails(acct);
    addNotification('Subscribe', `${name} subscribed to ${acct.owner}'s account`);
  };
}

/* ========== Commands Execution & UI Bindings ========== */

function executeCommand(cmd) {
  try {
    cmd.execute();
    commandStack.push(cmd);
    logCommand(cmd);
    $('stat-commands').textContent = commandStack.length;
  } catch (err) {
    addNotification('Error', err.message);
  }
}

function logCommand(cmd) {
  const hist = $('command-history');
  const el = document.createElement('div');
  el.className = 'item';
  const label = cmd.constructor.name.replace('Command','');
  el.innerHTML = `<div style="min-width:36px"><i class="fas fa-clipboard-check"></i></div>
    <div style="flex:1"><strong>${label}</strong><div style="color:var(--muted)">${now()}</div></div>`;
  hist.prepend(el);
}

/* ========== UI Actions Binding ========== */

$('create-acct').onclick = () => {
  const name = $('acct-name').value.trim();
  const type = $('acct-type').value;
  const balance = parseFloat($('acct-balance').value) || 0;
  if (!name) { showToast('Please enter customer name'); return; }
  const acct = new Account(nextAcctId++, name, type, balance);
  accounts.set(acct.id, acct);
  renderAccountsList();
  addNotification('Account Created', `${acct.owner} (${acct.type}) - Acc:${acct.id} created with ₹${acct.balance.toFixed(2)}`);
  // auto-subscribe owner as an observer (demo)
  const ownerObserver = new CustomerObserver(name, `${name.toLowerCase().replace(/\s+/g,'')}@demo.bank`, $('notifications-feed'));
  acct.subject.attach(ownerObserver);
  $('acct-name').value = ''; $('acct-balance').value = '';
};

$('cmd-deposit').onclick = () => {
  const id = parseInt($('from-account').value);
  const amount = Number($('amount').value);
  if (!id || !amount) { showToast('Select account and enter amount'); return; }
  const acct = accounts.get(id);
  const cmd = new DepositCommand(acct, amount);
  executeCommand(cmd);
  renderAccountsList();
};

$('cmd-withdraw').onclick = () => {
  const id = parseInt($('from-account').value);
  const amount = Number($('amount').value);
  if (!id || !amount) { showToast('Select account and enter amount'); return; }
  const acct = accounts.get(id);
  const cmd = new WithdrawCommand(acct, amount);
  executeCommand(cmd);
  renderAccountsList();
};

$('cmd-transfer').onclick = () => {
  const fromId = parseInt($('from-account').value);
  const toId = parseInt($('to-account').value);
  const amount = Number($('amount').value);
  if (!fromId || !toId || !amount) { showToast('Select both accounts and enter amount'); return; }
  const from = accounts.get(fromId);
  const to = accounts.get(toId);
  const cmd = new TransferCommand(from, to, amount);
  executeCommand(cmd);
  renderAccountsList();
};

$('cmd-undo').onclick = () => {
  if (commandStack.length === 0) { showToast('No commands to undo'); return; }
  const last = commandStack.pop();
  try {
    last.undo();
    addNotification('Undo', `${last.constructor.name} undone`);
    $('stat-commands').textContent = commandStack.length;
    renderAccountsList();
  } catch (e) {
    addNotification('Undo Error', e.message);
  }
};

/* Apply interest strategy */
$('apply-interest').onclick = () => {
  const id = parseInt($('interest-account').value);
  if (!id) { showToast('Select an account'); return; }
  const acct = accounts.get(id);
  let strat = new InterestStrategy();
  if (acct.type === 'savings') strat = new SavingsInterest();
  else if (acct.type === 'fixed') strat = new FixedInterest();
  else if (acct.type === 'current') strat = new CurrentInterest();
  acct.applyInterest(strat);
  renderAccountsList();
  addNotification('Interest', `Applied interest on ${acct.owner}`);
};

/* Demo setup and reset */
$('demo-setup').onclick = () => {
  // create sample accounts
  const demo = [
    ['Alice', 'savings', 5000],
    ['Bob', 'current', 1200],
    ['CorpX', 'fixed', 25000]
  ];
  demo.forEach(([n,t,b]) => {
    const acct = new Account(nextAcctId++, n, t, b);
    // auto attach owner observer
    acct.subject.attach(new CustomerObserver(n, `${n.toLowerCase()}@demo.bank`, $('notifications-feed')));
    accounts.set(acct.id, acct);
  });
  renderAccountsList();
  addNotification('Demo', 'Demo accounts created');
};

$('clear-all').onclick = () => {
  accounts.clear();
  commandStack.length = 0;
  nextAcctId = 1001;
  $('notifications-feed').innerHTML = '';
  $('command-history').innerHTML = '';
  $('stat-commands').textContent = '0';
  $('stat-observers').textContent = '0';
  renderAccountsList();
  $('acct-details').innerHTML = '<div class="empty">Select an account to see details.</div>';
};

/* initialize empty selects */
renderAccountsList();
