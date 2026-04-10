const path = require('path');
const fs = require('fs');
const axios = require('axios');

// PGWIZ Session Service
const SESSION_BASE_URL = 'https://session-s.pgwiz.cloud';

/**
 * Save credentials from PGWIZ Session Service to session/creds.json
 * @param {string} sessionId - Session ID from environment variable
 */
async function SaveCreds(sessionId) {
    const __dirname = path.dirname(__filename);

    if (!sessionId) {
        console.error('❌ No SESSION_ID provided');
        throw new Error('SESSION_ID is required');
    }

    const credsUrl = `${SESSION_BASE_URL}/download?id=${sessionId}`;
    console.log('🔑 SESSION_ID:', sessionId);
    console.log('🌐 Fetching from:', credsUrl);

    try {
        console.log('📥 Downloading session from PGWIZ Session Service...');
        const response = await axios.get(credsUrl);
        const data = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

        // Debug: Log downloaded content summary
        try {
            const parsed = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
            console.log('📋 Downloaded creds summary:');
            console.log('   - registered:', parsed.registered);
            console.log('   - has noiseKey:', !!parsed.noiseKey);
            console.log('   - has signedIdentityKey:', !!parsed.signedIdentityKey);
            console.log('   - has signedPreKey:', !!parsed.signedPreKey);
            console.log('   - has me:', !!parsed.me);
            if (parsed.me) {
                console.log('   - me.id:', parsed.me.id);
            }
        } catch (parseErr) {
            console.log('⚠️ Could not parse downloaded creds for debug:', parseErr.message);
            console.log('📋 Raw response (first 500 chars):', data.substring(0, 500));
        }

        const sessionDir = path.join(__dirname, '..', 'session');
        const shouldForceReset = String(process.env.FORCE_SESSION_RESET || '').toLowerCase() === 'true';

        if (shouldForceReset && fs.existsSync(sessionDir)) {
            console.log('🧹 FORCE_SESSION_RESET=true -> clearing old session files...');
            fs.rmSync(sessionDir, { recursive: true, force: true });
        }

        fs.mkdirSync(sessionDir, { recursive: true });

        if (!shouldForceReset) {
            console.log('♻️ Updating creds.json without clearing session key files');
        }

        const credsPath = path.join(sessionDir, 'creds.json');
        fs.writeFileSync(credsPath, data);
        console.log('✅ Session credentials saved successfully');

    } catch (error) {
        console.error('❌ Error downloading or saving credentials:', error.message);
        if (error.response) {
            console.error('❌ Status:', error.response.status);
            console.error('❌ Response:', error.response.data);
        }
        throw error;
    }
}

module.exports = SaveCreds;

