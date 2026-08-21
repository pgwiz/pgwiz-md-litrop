const settings = require('../settings');
const { isSudo } = require('./index');

function cleanJid(jid) {
    if (!jid) return '';
    return String(jid).split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
}

function getAllOwnerNumbers() {
    const rawEnv = process.env.OWNER_NUMBER || process.env.OWNER_NUMBERS || process.env.NUM_OWNER || process.env.OWNER || process.env.SUDO_USERS || '';
    const envList = rawEnv ? rawEnv.split(',').map(s => cleanJid(s.trim())).filter(Boolean) : [];
    const settingsList = Array.isArray(settings.ownerNumber)
        ? settings.ownerNumber.map(cleanJid)
        : [cleanJid(settings.ownerNumber)];
    return Array.from(new Set([...envList, ...settingsList])).filter(Boolean);
}

/**
 * Check if user is owner or sudo
 */
async function isOwnerOrSudo(senderId, sock = null, chatId = null) {
    if (!senderId) return false;
    const senderIdClean = cleanJid(senderId);
    if (!senderIdClean) return false;

    // 1. Bot's own identity from active socket
    if (sock && sock.user) {
        if (cleanJid(sock.user.id) === senderIdClean || (sock.user.lid && cleanJid(sock.user.lid) === senderIdClean)) {
            return true;
        }
    }

    // 2. All configured owners from ENV and settings
    const owners = getAllOwnerNumbers();
    if (owners.includes(senderIdClean)) {
        return true;
    }

    // 3. Sudo users from store / database
    try {
        const isSudoUser = await isSudo(senderId);
        if (isSudoUser) return true;
    } catch {}

    // 4. Group participant LID mapping
    if (sock && chatId && chatId.endsWith('@g.us') && senderId.includes('@lid')) {
        try {
            let metadata = global._groupMetadataCache?.get(chatId);
            if (!metadata || (Date.now() - metadata._fetchedAt > 60000)) {
                if (!global._groupMetadataCache) global._groupMetadataCache = new Map();
                const fresh = await sock.groupMetadata(chatId);
                if (fresh) {
                    fresh._fetchedAt = Date.now();
                    global._groupMetadataCache.set(chatId, fresh);
                    metadata = fresh;
                }
            }
            const participants = metadata?.participants || [];
            const participant = participants.find(p => p.lid === senderId || p.id === senderId);

            if (participant) {
                const pRealIdClean = cleanJid(participant.id);
                if (owners.includes(pRealIdClean) || await isSudo(participant.id)) {
                    return true;
                }
            }
        } catch (e) {}
    }

    return false;
}

/**
 * Check if user is ONLY owner
 */
function isOwnerOnly(senderId) {
    if (!senderId) return false;
    const senderIdClean = cleanJid(senderId);
    const owners = getAllOwnerNumbers();
    return owners.includes(senderIdClean);
}

/**
 * Helper for commands to show clean names/numbers
 */
async function getCleanName(jid, sock) {
    if (!jid) return 'Unknown';
    const cleanNumber = cleanJid(jid);
    return cleanNumber || 'Unknown';
}

module.exports = isOwnerOrSudo;
module.exports.isOwnerOnly = isOwnerOnly;
module.exports.cleanJid = cleanJid;
module.exports.getCleanName = getCleanName;
module.exports.getAllOwnerNumbers = getAllOwnerNumbers;
