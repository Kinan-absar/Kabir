import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { 
  Users, UserPlus, Shield, Check, X, Trash2, Mail, ShieldAlert, 
  Sparkles, RefreshCw, Key, ArrowRight, Eye, EyeOff, Loader2, Edit2
} from 'lucide-react';
import { saveUserProfile, deleteUserProfile } from '../dataService';
import { auth } from '../firebase';

interface UsersTabProps {
  profiles: UserProfile[];
  loading: boolean;
  onRefresh: (showSpinner?: boolean) => void;
  requestDelete: (title: string, description: string, category: string, onConfirm: () => void | Promise<void>) => void;
}

const AVAILABLE_TABS = [
  { id: 'dashboard', label: 'Dashboard', desc: 'Financial summaries, visual charts & metrics' },
  { id: 'sales', label: 'Daily Sales', desc: 'Log daily cash sales and digital credit portals' },
  { id: 'expenses', label: 'Expenses', desc: 'Track vendor bills, invoice receipts & tax groups' },
  { id: 'suppliers', label: 'Suppliers', desc: 'View global food suppliers & registered VAT metrics' },
  { id: 'accounts', label: 'Accounts', desc: 'Audit manual or system monthly business parameters' },
  { id: 'logs', label: 'Activity Logs', desc: 'Full audit history of creates, edits & deletes' },
];

export default function UsersTab({ profiles, loading, onRefresh, requestDelete }: UsersTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  
  // Registration Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'employee'>('employee');
  const [newAllowedTabs, setNewAllowedTabs] = useState<string[]>(['sales', 'expenses', 'suppliers']);
  const [addingError, setAddingError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Profile inline edit states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // Status/Feedback States for Individual Rows (map of userId -> string e.g. "Saving..." or "Saved!")
  const [rowStatus, setRowStatus] = useState<Record<string, string>>({});

  const currentUserUid = auth.currentUser?.uid;

  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      const emailSafe = p.email || '';
      const nameSafe = p.name || '';
      const matchSearch = 
        emailSafe.toLowerCase().includes(searchTerm.toLowerCase()) ||
        nameSafe.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchRole = !roleFilter || p.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [profiles, searchTerm, roleFilter]);

  const startEdit = (p: UserProfile) => {
    setEditingId(p.id);
    setEditName(p.name || '');
    setEditEmail(p.email || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditEmail('');
  };

  const handleSaveDetails = async (p: UserProfile) => {
    setRowStatus(prev => ({ ...prev, [p.id]: 'Saving...' }));
    try {
      const updated: UserProfile = {
        ...p,
        name: editName.trim() || undefined,
        email: editEmail.trim().toLowerCase()
      };
      await saveUserProfile(updated);
      setRowStatus(prev => ({ ...prev, [p.id]: 'Saved ✓' }));
      setEditingId(null);
      setTimeout(() => {
        setRowStatus(prev => {
          const copy = { ...prev };
          delete copy[p.id];
          return copy;
        });
      }, 2000);
      onRefresh(false);
    } catch (e: any) {
      setRowStatus(prev => ({ ...prev, [p.id]: 'Error' }));
      alert(`Failed to save details: ${e.message}`);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'employee') => {
    // Check safety
    if (userId === currentUserUid) {
      alert("You cannot change your own admin role. This safety measure ensures you don't lock yourself out.");
      return;
    }

    const currentProfile = profiles.find(p => p.id === userId);
    if (!currentProfile) return;

    // Set saving state
    setRowStatus(prev => ({ ...prev, [userId]: 'Saving...' }));

    try {
      // Default recommended tabs on role swap
      let allowed = currentProfile.allowedTabs || [];
      if (newRole === 'admin' && allowed.length < 5) {
        allowed = ['dashboard', 'sales', 'expenses', 'suppliers', 'accounts', 'logs', 'users'];
      } else if (newRole === 'employee' && allowed.includes('users')) {
        allowed = allowed.filter(t => t !== 'users' && t !== 'logs' && t !== 'accounts');
      }

      const updated: UserProfile = {
        ...currentProfile,
        role: newRole,
        allowedTabs: allowed
      };
      await saveUserProfile(updated);
      
      setRowStatus(prev => ({ ...prev, [userId]: 'Saved ✓' }));
      setTimeout(() => {
        setRowStatus(prev => {
          const copy = { ...prev };
          delete copy[userId];
          return copy;
        });
      }, 2000);
      onRefresh(false);
    } catch (e: any) {
      setRowStatus(prev => ({ ...prev, [userId]: 'Error' }));
      alert(`Failed to update role: ${e.message}`);
    }
  };

  const handleToggleTabPermission = async (userId: string, tabId: string) => {
    // Check safety
    if (userId === currentUserUid && tabId === 'users') {
      alert("You cannot revoke your own privilege to manage Team & Permissions.");
      return;
    }

    const currentProfile = profiles.find(p => p.id === userId);
    if (!currentProfile) return;

    const allowed = currentProfile.allowedTabs ? [...currentProfile.allowedTabs] : [];
    const index = allowed.indexOf(tabId);
    if (index > -1) {
      allowed.splice(index, 1);
    } else {
      allowed.push(tabId);
    }

    // Set saving state
    setRowStatus(prev => ({ ...prev, [userId]: 'Saving...' }));

    try {
      const updated: UserProfile = {
        ...currentProfile,
        allowedTabs: allowed
      };
      await saveUserProfile(updated);
      
      setRowStatus(prev => ({ ...prev, [userId]: 'Saved ✓' }));
      setTimeout(() => {
        setRowStatus(prev => {
          const copy = { ...prev };
          delete copy[userId];
          return copy;
        });
      }, 2000);
      onRefresh(false);
    } catch (e: any) {
      setRowStatus(prev => ({ ...prev, [userId]: 'Error' }));
      alert(`Failed to update tab access: ${e.message}`);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingError(null);

    const emailClean = newEmail.trim().toLowerCase();
    if (!emailClean) {
      setAddingError('Email address is required.');
      return;
    }

    // Check duplicate
    const exists = profiles.some(p => p.email.toLowerCase() === emailClean);
    if (exists) {
      setAddingError(`A user with email ${emailClean} already exists in the system.`);
      return;
    }

    setIsAdding(true);
    try {
      // Use email prefix or a temporary id as Document ID
      const fakeUid = 'pre_' + Math.random().toString(36).substring(2, 11);
      const newProfile: UserProfile = {
        id: fakeUid,
        email: emailClean,
        name: newName.trim() || undefined,
        role: newRole,
        allowedTabs: newAllowedTabs,
        created_at: new Date().toISOString()
      };
      
      await saveUserProfile(newProfile);
      
      // Reset form
      setNewEmail('');
      setNewName('');
      setNewRole('employee');
      setNewAllowedTabs(['sales', 'expenses', 'suppliers']);
      setShowAddForm(false);
      onRefresh(false);
    } catch (e: any) {
      setAddingError(e.message || 'Error pre-authorizing team member.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleSelectTabPlaceholder = (tabId: string) => {
    setNewAllowedTabs(prev => 
      prev.includes(tabId) ? prev.filter(t => t !== tabId) : [...prev, tabId]
    );
  };

  const handleDeleteUserClick = (targetProfile: UserProfile) => {
    if (targetProfile.id === currentUserUid) {
      alert("You cannot delete your own account from the permissions board.");
      return;
    }

    const desc = targetProfile.id.startsWith('pre_') 
      ? `This will permanently delete the pre-authorized profile for ${targetProfile.email}. The reservation will be revoked.`
      : `This will permanently delete authentication profiles and settings for user account ${targetProfile.email}. They will lose all access to the Bistro database.`;

    requestDelete(
      'Remove Team Member Access',
      `${desc} All configuration variables for this user will be deleted permanently.`,
      'user_profile',
      async () => {
        await deleteUserProfile(targetProfile.id);
        onRefresh(false);
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Overview Block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-stone-900 tracking-tight">Team Access & Custom Permissions</h2>
          <p className="text-xs text-stone-500 font-medium mt-1">
            Map security profiles to individual employees. Real-time switches enable immediate feature lockout or access grants.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 bg-emerald-900 hover:bg-emerald-950 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95 shrink-0"
          >
            {showAddForm ? <X size={14} /> : <UserPlus size={14} />}
            <span>{showAddForm ? 'Close panel' : 'Pre-register Staff Member'}</span>
          </button>
          
          <button 
            type="button"
            onClick={onRefresh}
            className="p-2.5 bg-white border border-stone-200 text-stone-500 hover:text-emerald-800 rounded-xl hover:bg-stone-50 transition-all shadow-xs"
            title="Update live dataset"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Pre-register employee drawer */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleAddUser} className="bg-gradient-to-br from-emerald-950 to-stone-900 text-white p-6 rounded-3xl border border-emerald-900/40 shadow-xl space-y-5">
              <div className="flex items-center gap-2 text-emerald-400">
                <Sparkles size={16} />
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Pre-Authorise & Provision Account Settings</h3>
              </div>
              <p className="text-xs text-stone-300 font-medium max-w-2xl leading-relaxed">
                By entering their registration email below, you define their secure permission boundaries.
                When the employee logs in with this email, the applet reads their defined profile and displays authorized tabs instantly.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Email input */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-2">Email Address *</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input 
                      required
                      type="email" 
                      placeholder="employee@alkabir.com" 
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-stone-800/80 border border-emerald-800/30 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>

                {/* Nickname input */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-2">Display Name (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Kinan Mahmalat" 
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-stone-800/80 border border-emerald-800/30 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>

                {/* Initial Role Select */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-2">Security Profile (Role)</label>
                  <select 
                    value={newRole}
                    onChange={e => {
                      const r = e.target.value as 'admin' | 'employee';
                      setNewRole(r);
                      if (r === 'admin') {
                        setNewAllowedTabs(['dashboard', 'sales', 'expenses', 'suppliers', 'accounts', 'logs']);
                      } else {
                        setNewAllowedTabs(['sales', 'expenses', 'suppliers']);
                      }
                    }}
                    className="w-full px-4 py-2.5 bg-stone-800/80 border border-emerald-800/30 rounded-xl text-xs text-white cursor-pointer focus:outline-none"
                  >
                    <option value="employee" className="bg-stone-900">Employee Profile (Limited Access)</option>
                    <option value="admin" className="bg-stone-900">Administrator Profile (Full Access)</option>
                  </select>
                </div>
              </div>

              {/* Checkbox Permission List */}
              <div className="space-y-2 pt-2">
                <label className="block text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-3">Pre-Approved App Modules (Target Tabs)</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {AVAILABLE_TABS.map(tab => {
                    const isSelected = newAllowedTabs.includes(tab.id);
                    return (
                      <button
                        type="button"
                        key={tab.id}
                        onClick={() => handleSelectTabPlaceholder(tab.id)}
                        className={`flex items-start text-left p-3 rounded-2xl border transition-all ${
                          isSelected 
                            ? 'bg-emerald-900/60 border-emerald-500 text-white' 
                            : 'bg-stone-800/30 border-stone-800 text-stone-400 hover:bg-stone-800/50'
                        }`}
                      >
                        <div className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mr-3 transition-colors ${
                          isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-600 bg-stone-800'
                        }`}>
                          {isSelected && <Check size={11} className="stroke-[3]" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white leading-none">{tab.label}</p>
                          <p className="text-[10px] text-stone-400 mt-1.5 leading-snug font-medium">{tab.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {addingError && (
                <div className="p-4 bg-rose-950/80 text-rose-300 border border-rose-900 rounded-2xl text-xs font-bold flex items-center gap-2">
                  <ShieldAlert size={14} className="shrink-0" />
                  <span>{addingError}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-emerald-900/30 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 font-bold text-xs text-stone-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/10 flex items-center gap-2"
                >
                  {isAdding ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
                  <span>Add Pre-approved User</span>
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Directory filter controllers */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
          <input 
            type="text" 
            placeholder="Search team member by email, name, organization identifier..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-800/10"
          />
        </div>

        <div className="flex gap-2">
          <select 
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="text-xs font-semibold bg-white border border-stone-200 rounded-lg px-3 py-2 text-stone-600 cursor-pointer shadow-sm focus:outline-none"
          >
            <option value="">All Security Roles</option>
            <option value="admin">Administrators</option>
            <option value="employee">Employees</option>
          </select>
        </div>
      </div>

      {/* Main Employee list cards / Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-4 border-stone-800 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-stone-400 font-bold">Synchronising Team Directory...</p>
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-16 text-center">
          <Users size={36} className="mx-auto text-stone-300 mb-2" />
          <h4 className="text-sm font-bold text-stone-700">No matching team members found</h4>
          <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto leading-relaxed">
            Try adjusting your search criteria or pre-register a new team member.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredProfiles.map(p => {
            const isSelf = p.id === currentUserUid;
            const isProvisioned = !p.id.startsWith('pre_');
            const status = rowStatus[p.id];

            return (
              <div 
                key={p.id} 
                className="bg-white border border-stone-200 rounded-3xl shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col md:flex-row"
              >
                {/* Profile Card Summary & Identification */}
                <div className="md:w-72 p-6 border-b md:border-b-0 md:border-r border-stone-100 flex flex-col justify-between bg-stone-50/20">
                  <div className="space-y-4">
                    {editingId === p.id ? (
                      <div className="space-y-3 bg-white p-3 rounded-2xl border border-stone-200 shadow-xs">
                        <div>
                          <label className="block text-[8px] uppercase font-black text-stone-400 tracking-wider mb-1">Display Name</label>
                          <input 
                            type="text" 
                            className="w-full px-2 py-1 bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            placeholder="e.g. Kinan Mahmalat"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] uppercase font-black text-stone-400 tracking-wider mb-1">Email Address</label>
                          <input 
                            type="email" 
                            className="w-full px-2 py-1 bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            value={editEmail}
                            onChange={e => setEditEmail(e.target.value)}
                            placeholder="user@alkabir.com"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleSaveDetails(p)}
                            className="bg-emerald-900 hover:bg-emerald-950 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                          >
                            <Check size={11} className="stroke-[2.5]" /> Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="border border-stone-200 text-stone-500 hover:text-stone-700 hover:bg-stone-50 font-bold text-[10px] px-2.5 py-1.5 rounded-lg cursor-pointer transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm uppercase shadow-xs shrink-0 ${
                            p.role === 'admin' ? 'bg-emerald-900 text-white' : 'bg-stone-200 text-stone-600'
                          }`}>
                            {(p.name || p.email || 'US').substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-black text-stone-800 truncate leading-snug">
                              {p.name || (p.email ? p.email.split('@')[0] : `No Name (ID: ${p.id.substring(0, 5)})`)}
                            </h4>
                            <p className="text-[10px] text-stone-400 font-semibold truncate leading-none mt-1" title={p.email || 'No email saved'}>
                              {p.email || 'No email saved (Click Pencil to edit)'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => startEdit(p)}
                          className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-600 transition cursor-pointer shrink-0"
                          title="Edit email and name"
                        >
                          <Edit2 size={13} className="stroke-[2.5]" />
                        </button>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] uppercase text-stone-400 font-bold tracking-wider">Account Mode:</span>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          isProvisioned ? 'bg-sky-50 text-sky-700 border border-sky-100' : 'bg-amber-50 text-amber-800 border border-amber-100'
                        }`}>
                          {isProvisioned ? 'Verified User' : 'Pending Sign-in'}
                        </span>
                      </div>

                      {isSelf && (
                        <div className="flex items-center gap-1 text-[9px] text-emerald-800 font-bold bg-emerald-50 w-fit px-2 py-0.5 border border-emerald-150 rounded-full">
                          <Check size={10} className="stroke-[2.5]" />
                          <span>Active Session Account</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-stone-100/60 mt-4 space-y-4">
                    <div>
                      <label className="block text-[8px] uppercase font-black text-stone-400 tracking-wider mb-2">Primary App Privilege Role</label>
                      <select 
                        disabled={isSelf}
                        value={p.role}
                        onChange={e => handleRoleChange(p.id, e.target.value as any)}
                        className={`text-xs font-bold rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer w-full border ${
                          isSelf ? 'bg-stone-100 text-stone-505 border-stone-200' : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300'
                        }`}
                      >
                        <option value="employee">Employee Profile</option>
                        <option value="admin">Administrator (Full Master)</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      {status ? (
                        <span className={`text-[10px] font-black ${
                          status.includes('✓') ? 'text-emerald-600' : status.includes('Error') ? 'text-rose-600' : 'text-stone-550'
                        }`}>
                          {status}
                        </span>
                      ) : (
                        <span className="text-[10px] text-stone-400 font-bold">Permissions Active</span>
                      )}

                      {!isSelf && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUserClick(p)}
                          className="flex items-center gap-1 text-[10px] font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-xl transition"
                        >
                          <Trash2 size={11} />
                          <span>Revoke Access</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Grid of togglable permissions (modules) */}
                <div className="flex-1 p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                    <h5 className="text-[10px] uppercase font-black text-stone-400 tracking-wider">Module Level Authorization switches</h5>
                    <span className="text-[10px] font-semibold text-stone-400 italic">Toggle modules to adjust access live</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {AVAILABLE_TABS.map(tab => {
                      const isAllowed = p.allowedTabs?.includes(tab.id) ?? (p.role === 'admin');
                      const disabledSelfLock = isSelf && tab.id === 'users';

                      return (
                        <button
                          type="button"
                          key={tab.id}
                          disabled={disabledSelfLock}
                          onClick={() => handleToggleTabPermission(p.id, tab.id)}
                          className={`flex items-start text-left p-3.5 rounded-2xl border transition ${
                            isAllowed 
                              ? 'bg-emerald-50/20 border-emerald-200 text-emerald-900 hover:bg-emerald-50/40' 
                              : 'bg-stone-50/30 border-stone-100 text-stone-400 hover:bg-stone-50/50 hover:border-stone-200'
                          } ${disabledSelfLock ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mr-3 transition-all ${
                            isAllowed ? 'bg-emerald-900 border-emerald-900 text-white' : 'border-stone-200 bg-stone-50 text-transparent'
                          }`}>
                            <Check size={11} className="stroke-[3]" />
                          </div>
                          <div>
                            <span className="text-xs font-black leading-none block text-stone-800">{tab.label}</span>
                            <span className="text-[10px] text-stone-400/90 leading-snug font-medium block mt-1.5">{tab.desc}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
