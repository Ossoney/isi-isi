/* ============================================
   isi-isi — Supabase Client
   Capa de datos: CRUD + Realtime
   ============================================ */

const SUPABASE_URL = 'https://aflpxilsezeaktaomnwn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bjeODbLvBBtVQehbxabDFw_YQVtZo7Q';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let _realtimeChannel = null;

// ---- Groups ----
async function sbCreateGroup(name, currency) {
  const { data, error } = await _supabase.from('groups').insert({ name, currency }).select().single();
  if (error) throw error;
  return data;
}
async function sbGetGroup(groupId) {
  const { data, error } = await _supabase.from('groups').select('*').eq('id', groupId).single();
  if (error) throw error;
  return data;
}
async function sbUpdateGroupName(groupId, name) {
  const { error } = await _supabase.from('groups').update({ name }).eq('id', groupId);
  if (error) throw error;
}
async function sbDeleteGroup(groupId) {
  const { error } = await _supabase.from('groups').delete().eq('id', groupId);
  if (error) throw error;
}

// ---- Members ----
async function sbCreateMember(groupId, name) {
  const { data, error } = await _supabase.from('members').insert({ group_id: groupId, name }).select().single();
  if (error) throw error;
  return data;
}
async function sbGetMembers(groupId) {
  const { data, error } = await _supabase.from('members').select('*').eq('group_id', groupId).order('created_at');
  if (error) throw error;
  return data || [];
}
async function sbDeleteMember(memberId) {
  const { error } = await _supabase.from('members').delete().eq('id', memberId);
  if (error) throw error;
}

// ---- Expenses ----
function sbExpenseToLocal(row) {
  return { id: row.id, title: row.title, amount: parseFloat(row.amount), paidBy: row.paid_by, category: row.category, date: row.date, splitMode: row.split_mode, splits: row.splits, createdAt: row.created_at };
}
async function sbGetExpenses(groupId) {
  const { data, error } = await _supabase.from('expenses').select('*').eq('group_id', groupId).order('date', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(sbExpenseToLocal);
}
async function sbCreateExpense(groupId, expense) {
  const { data, error } = await _supabase.from('expenses').insert({ group_id: groupId, title: expense.title, amount: expense.amount, paid_by: expense.paidBy, category: expense.category, date: expense.date, split_mode: expense.splitMode, splits: expense.splits }).select().single();
  if (error) throw error;
  return sbExpenseToLocal(data);
}
async function sbUpdateExpense(expense) {
  const { error } = await _supabase.from('expenses').update({ title: expense.title, amount: expense.amount, paid_by: expense.paidBy, category: expense.category, date: expense.date, split_mode: expense.splitMode, splits: expense.splits }).eq('id', expense.id);
  if (error) throw error;
}
async function sbDeleteExpense(expenseId) {
  const { error } = await _supabase.from('expenses').delete().eq('id', expenseId);
  if (error) throw error;
}

// ---- Payments ----
function sbPaymentToLocal(row) {
  return { id: row.id, from: row.from_member, to: row.to_member, amount: parseFloat(row.amount), createdAt: row.created_at };
}
async function sbGetPayments(groupId) {
  const { data, error } = await _supabase.from('payments').select('*').eq('group_id', groupId).order('created_at');
  if (error) throw error;
  return (data || []).map(sbPaymentToLocal);
}
async function sbCreatePayment(groupId, from, to, amount) {
  const { data, error } = await _supabase.from('payments').insert({ group_id: groupId, from_member: from, to_member: to, amount }).select().single();
  if (error) throw error;
  return sbPaymentToLocal(data);
}
async function sbDeletePayment(paymentId) {
  const { error } = await _supabase.from('payments').delete().eq('id', paymentId);
  if (error) throw error;
}

// ---- Load full group state ----
async function sbLoadGroup(groupId) {
  const [groupData, members, expenses, payments] = await Promise.all([
    sbGetGroup(groupId),
    sbGetMembers(groupId),
    sbGetExpenses(groupId),
    sbGetPayments(groupId)
  ]);
  return { groupData, members, expenses, payments };
}

// ---- Realtime subscription ----
function sbSubscribe(groupId, onChange) {
  sbUnsubscribe();
  _realtimeChannel = _supabase
    .channel('group-' + groupId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: 'group_id=eq.' + groupId }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: 'group_id=eq.' + groupId }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: 'group_id=eq.' + groupId }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'groups', filter: 'id=eq.' + groupId }, onChange)
    .subscribe((status) => { updateConnectionStatus(status === 'SUBSCRIBED'); });
}
function sbUnsubscribe() {
  if (_realtimeChannel) { _supabase.removeChannel(_realtimeChannel); _realtimeChannel = null; }
}

// ---- Connection indicator ----
function updateConnectionStatus(online) {
  const dot = document.getElementById('connection-dot');
  if (dot) {
    dot.className = online ? 'conn-dot conn-online' : 'conn-dot conn-offline';
    dot.title = online ? 'Sincronizado en tiempo real' : 'Sin conexion';
  }
}
