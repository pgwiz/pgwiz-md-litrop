'use strict';

/**
 * Custom Buttons & Keith MD Rich Messages Test Suite
 * 
 * Provides interactive test cases (1 - 14) for all WhatsApp Native Flow button primitives,
 * classic ButtonV2 messages, and Keith MD rich AI-response engine:
 * - Case 1: Quick Reply Buttons (Instant Command Callbacks)
 * - Case 2: Call-to-Action Buttons (CTA URL & Copy Code to Clipboard)
 * - Case 3: Telephony Call Action Buttons
 * - Case 4: Hybrid Native Flow (All 4 Primitive Types Combined)
 * - Case 5: Single Select List Menu (Sections & Interactive Rows)
 * - Case 6: Clean Buttons (Just Message Content & Buttons; append 'loc' for Location Header)
 * - Case 7: Dynamic User-Generated Custom Buttons
 * - Case 8: Keith MD Rich Table (sendTable / sendTableV2)
 * - Case 9: Keith MD Rich List (sendList)
 * - Case 10: Keith MD Rich Code Block (sendCodeBlock / sendCodeBlockV2)
 * - Case 11: Keith MD Rich Link Cards (sendLink / sendLinkV2)
 * - Case 12: Keith MD Rich LaTeX Formula (sendLatex)
 * - Case 13: Keith MD Combined Multi-Type Rich Message (sendRichMessage)
 * - Case 14: Keith MD Unified Response Echo (sendUnifiedResponse)
 */

module.exports = {
    command: 'testbutton',
    aliases: ['testbtn', 'testbuttons', 'buttons', 'btn', 'custombutton', 'custombuttons', 'testrich', 'rich'],
    category: 'tools',
    description: 'Test interactive WhatsApp native flow custom buttons, classic ButtonV2, and Keith MD rich messages (Cases 1 - 14)',
    usage: '.testbtn [1-14] | .testbtn 7 <title> | <text> | <btn1, btn2, ...> | .testbtn [1-5] viewonce',

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const subCommand = (args[0] || '').toLowerCase().trim();
        const useViewOnce = args.includes('viewonce') || args.includes('vo');

        // Helper to dispatch native flow buttons reliably via sock.sendButtons or sock.sendMessage
        const dispatchButtons = async (payload) => {
            if (typeof sock.sendButtons === 'function') {
                return await sock.sendButtons(chatId, { ...payload, viewOnce: useViewOnce }, message);
            }
            return await sock.sendMessage(chatId, payload, { quoted: message });
        };

        // ==========================================
        // TEST CASE 1: Standard Quick Replies
        // ==========================================
        if (subCommand === '1' || subCommand === 'quick' || subCommand === 'reply') {
            const payload = {
                title: '🔘 TEST CASE 1: QUICK REPLIES',
                subtitle: 'Interactive Command Callbacks',
                text: 'Tap any button below to trigger the command callback instantly:',
                footer: 'PGWIZ-MD • Native Flow Primitives',
                buttons: [
                    {
                        type: 'quick_reply',
                        text: '🏓 Ping Latency',
                        id: '.ping'
                    },
                    {
                        type: 'quick_reply',
                        text: '📊 System Status',
                        id: '.alive'
                    },
                    {
                        type: 'quick_reply',
                        text: '🤖 AI Mode Status',
                        id: '.aimode status'
                    }
                ]
            };
            return await dispatchButtons(payload);
        }

        // ==========================================
        // TEST CASE 2: Call-to-Action (URL & Copy Code)
        // ==========================================
        if (subCommand === '2' || subCommand === 'cta' || subCommand === 'url' || subCommand === 'copy') {
            const payload = {
                title: '🌐 TEST CASE 2: ACTION BUTTONS (CTA)',
                subtitle: 'Deep-link URLs & Clipboard Copy',
                text: 'Test external web links and one-tap clipboard copy buttons:',
                footer: 'PGWIZ-MD • Native Flow Primitives',
                buttons: [
                    {
                        type: 'url',
                        text: '🌐 GitHub Repository',
                        url: 'https://github.com/pgwiz/PGWIZ-MD'
                    },
                    {
                        type: 'copy',
                        text: '📋 Copy Access Token',
                        copy_code: 'PGWIZ-SUPER-2026-VIP'
                    },
                    {
                        type: 'url',
                        text: '📢 Official Channel',
                        url: 'https://whatsapp.com/channel/0029VaFytMo4NVik2zJc1w1R'
                    }
                ]
            };
            return await dispatchButtons(payload);
        }

        // ==========================================
        // TEST CASE 3: Direct Phone Call Button
        // ==========================================
        if (subCommand === '3' || subCommand === 'call' || subCommand === 'phone') {
            const payload = {
                title: '📞 TEST CASE 3: CALL ACTIONS',
                subtitle: 'Native Telephony Integration',
                text: 'Test native WhatsApp direct dialer integration button:',
                footer: 'PGWIZ-MD • Native Flow Primitives',
                buttons: [
                    {
                        type: 'call',
                        text: '📞 Call Helpdesk Support',
                        phone_number: '+254700000000'
                    },
                    {
                        type: 'quick_reply',
                        text: '💬 Contact Owner via Chat',
                        id: '.owner'
                    }
                ]
            };
            return await dispatchButtons(payload);
        }

        // ==========================================
        // TEST CASE 4: Hybrid Native Flow (All 4 Primitives)
        // ==========================================
        if (subCommand === '4' || subCommand === 'hybrid' || subCommand === 'all') {
            const payload = {
                title: '⚡ TEST CASE 4: HYBRID NATIVE FLOW',
                subtitle: 'All 4 Button Primitives in One Payload',
                text: 'This message combines Quick Reply, URL link, Clipboard Copy, and Telephony Call:',
                footer: 'PGWIZ-MD • Native Flow Primitives',
                buttons: [
                    {
                        type: 'quick_reply',
                        text: '🔘 Quick Reply Test',
                        id: '.testbtn 1'
                    },
                    {
                        type: 'url',
                        text: '🌐 Open Web Portal',
                        url: 'https://github.com'
                    },
                    {
                        type: 'copy',
                        text: '📋 Copy Voucher Code',
                        copy_code: 'PROMO-2026-ROCKET'
                    },
                    {
                        type: 'call',
                        text: '📞 Emergency Hotline',
                        phone_number: '+18005550199'
                    }
                ]
            };
            return await dispatchButtons(payload);
        }

        // ==========================================
        // TEST CASE 5: Single Select List Menu
        // ==========================================
        if (subCommand === '5' || subCommand === 'list' || subCommand === 'select' || subCommand === 'menu') {
            const payload = {
                title: '📋 TEST CASE 5: INTERACTIVE LIST MENU',
                subtitle: 'Single-Select Dropdown with Categorized Sections',
                text: 'Tap the button below to open a multi-section interactive list menu with custom rows:',
                footer: 'PGWIZ-MD • Native Flow Primitives',
                buttons: [
                    {
                        type: 'single_select',
                        title: '📋 Open Options Menu',
                        sections: [
                            {
                                title: '⚡ Core Bot Commands',
                                rows: [
                                    {
                                        header: 'Latency Test',
                                        title: '🏓 Ping Bot',
                                        description: 'Measure real-time WebSocket round-trip ping',
                                        id: '.ping'
                                    },
                                    {
                                        header: 'Connection Health',
                                        title: '📡 Keepalive Status',
                                        description: 'Inspect active XMPP heartbeat & socket state',
                                        id: '.keepalive'
                                    },
                                    {
                                        header: 'Presence State',
                                        title: '🟢 Always Online Status',
                                        description: 'Inspect continuous companion online presence',
                                        id: '.alwaysonline'
                                    }
                                ]
                            },
                            {
                                title: '🎨 Media & Intelligence',
                                rows: [
                                    {
                                        header: 'HD Image Search',
                                        title: '🖼️ Search Images (Porsche)',
                                        description: 'Fetch 4 high-definition photos via Bing',
                                        id: '.gimg Porsche 911'
                                    },
                                    {
                                        header: 'Conversational AI',
                                        title: '🤖 AI Mode Overview',
                                        description: 'Configure conversational personas and reply modes',
                                        id: '.aimode'
                                    },
                                    {
                                        header: 'System Info',
                                        title: '📊 Bot Alive Stats',
                                        description: 'Show uptime, RAM usage, and version info',
                                        id: '.alive'
                                    }
                                ]
                            }
                        ]
                    }
                ]
            };
            return await dispatchButtons(payload);
        }

        // ==========================================
        // TEST CASE 6: Clean Buttons (Just Message Content & Buttons)
        // Append 'loc' or 'location' to test legacy location header
        // ==========================================
        if (subCommand === '6' || subCommand === 'classic' || subCommand === 'v2') {
            const withLocation = args.includes('loc') || args.includes('location');
            if (typeof sock.sendButtonV2 === 'function') {
                return await sock.sendButtonV2(chatId, {
                    text: 'Testing clean buttons: just the message content and interactive buttons without any location card or AI tag.',
                    footer: 'PGWIZ-MD • Clean Buttons Engine',
                    buttons: [
                        { text: '🏓 Ping Latency', id: '.ping' },
                        { text: '📊 System Status', id: '.alive' },
                        { text: '🤖 AI Mode Status', id: '.aimode status' }
                    ],
                    location: withLocation,
                    title: withLocation ? '⚡ CLASSIC BUTTONS V2' : '',
                    subtitle: withLocation ? 'Legacy Location Header Type 6' : ''
                }, message);
            }
            return await sock.sendMessage(chatId, { text: '⚠️ sock.sendButtonV2 is not available on this socket.' }, { quoted: message });
        }

        // ==========================================
        // TEST CASE 7: Custom User-Defined Buttons
        // Syntax: .testbtn 7 <Title> | <Body> | <Btn1, Btn2, ...>
        // ==========================================
        if (subCommand === '7' || subCommand === 'custom') {
            const customQuery = args.slice(1).join(' ').trim();
            if (!customQuery || !customQuery.includes('|')) {
                return await sock.sendMessage(chatId, {
                    text: '⚙️ *Dynamic Custom Button Generator*\n\n' +
                          '*Format:*\n' +
                          '`.testbtn 7 <Title> | <Text Content> | <Button 1, Button 2, ...>`\n\n' +
                          '*Example:*\n' +
                          '`.testbtn 7 Welcome VIP | Choose your plan below: | Basic, Pro, Enterprise`'
                }, { quoted: message });
            }

            const parts = customQuery.split('|').map(s => s.trim());
            const customTitle = parts[0] || 'Custom Buttons';
            const customBody = parts[1] || 'Select an option:';
            const rawButtons = (parts[2] || '').split(',').map(s => s.trim()).filter(Boolean);

            if (rawButtons.length === 0) {
                return await sock.sendMessage(chatId, {
                    text: '❌ Please provide at least one button label separated by commas.\n\n*Example:* `.testbtn 7 Survey | Do you like it? | Yes, No, Maybe`'
                }, { quoted: message });
            }

            const buttons = rawButtons.slice(0, 5).map((label, idx) => ({
                type: 'quick_reply',
                text: label,
                id: label.startsWith('.') ? label : `.echo Selected: ${label}`
            }));

            const payload = {
                title: `✨ ${customTitle.toUpperCase()}`,
                text: customBody,
                footer: 'PGWIZ-MD • Dynamic Button Generator',
                buttons
            };
            return await dispatchButtons(payload);
        }

        // ==========================================
        // TEST CASE 8: Keith MD Rich Table
        // ==========================================
        if (subCommand === '8' || subCommand === 'table') {
            if (typeof sock.sendTable === 'function') {
                return await sock.sendTable(
                    chatId,
                    '📊 Server Performance Metrics',
                    ['Metric', 'Current Value', 'Status'],
                    [
                        ['WebSocket Latency', '142ms', 'Optimal 🟢'],
                        ['Heap Memory', '84 MB / 512 MB', 'Healthy 🟢'],
                        ['Uptime', '48 Hours', 'Active 🟢'],
                        ['Pre-Keys Pool', '95 Available', 'Synchronized 🟢']
                    ],
                    message,
                    { footer: 'PGWIZ-MD • Keith MD Rich Response Engine' }
                );
            }
            return await sock.sendMessage(chatId, { text: '⚠️ sock.sendTable is not available on this socket.' }, { quoted: message });
        }

        // ==========================================
        // TEST CASE 9: Keith MD Rich List
        // ==========================================
        if (subCommand === '9' || subCommand === 'listrich') {
            if (typeof sock.sendList === 'function') {
                return await sock.sendList(
                    chatId,
                    '📋 Available Core Features',
                    [
                        '🚀 High-Speed Baileys Multi-Device Engine',
                        '🛡️ Anti-Delete & Status Auto-View / Reaction',
                        '🤖 Conversational AI Multi-Persona Modes',
                        '📊 Live System Performance & Telemetry',
                        '🔘 Native Flow & Rich Response UI Suite'
                    ],
                    message,
                    { footer: 'PGWIZ-MD • Keith MD Rich Response Engine' }
                );
            }
            return await sock.sendMessage(chatId, { text: '⚠️ sock.sendList is not available on this socket.' }, { quoted: message });
        }

        // ==========================================
        // TEST CASE 10: Keith MD Rich Code Block
        // ==========================================
        if (subCommand === '10' || subCommand === 'code') {
            if (typeof sock.sendCodeBlockV2 === 'function') {
                return await sock.sendCodeBlockV2(
                    chatId,
                    {
                        language: 'javascript',
                        title: '⚡ Custom Baileys Keepalive Engine',
                        code: `// Active WebSocket deadman watchdog\nfunction keepAliveWatchdog(sock) {\n    const silenceMs = Date.now() - sock.lastActivity;\n    if (silenceMs > 45000) {\n        sock.sendPing();\n    }\n}`
                    },
                    message,
                    { footer: 'PGWIZ-MD • Keith MD Rich Response Engine' }
                );
            }
            return await sock.sendMessage(chatId, { text: '⚠️ sock.sendCodeBlockV2 is not available on this socket.' }, { quoted: message });
        }

        // ==========================================
        // TEST CASE 11: Keith MD Rich Link Cards
        // ==========================================
        if (subCommand === '11' || subCommand === 'link') {
            if (typeof sock.sendLinkV2 === 'function') {
                return await sock.sendLinkV2(
                    chatId,
                    '🔗 Official Resources & Documentation',
                    [
                        {
                            url: 'https://github.com/pgwiz/PGWIZ-MD',
                            displayName: 'PGWIZ-MD Repository',
                            sourceDisplayName: 'GitHub',
                            sourceSubtitle: 'Official Source Code'
                        },
                        {
                            url: 'https://whatsapp.com/channel/0029VaFytMo4NVik2zJc1w1R',
                            displayName: 'WIP Tech Channel',
                            sourceDisplayName: 'WhatsApp Channels',
                            sourceSubtitle: 'Official Community Updates'
                        }
                    ],
                    message,
                    { footer: 'PGWIZ-MD • Keith MD Rich Response Engine' }
                );
            }
            return await sock.sendMessage(chatId, { text: '⚠️ sock.sendLinkV2 is not available on this socket.' }, { quoted: message });
        }

        // ==========================================
        // TEST CASE 12: Keith MD Rich LaTeX Formula
        // ==========================================
        if (subCommand === '12' || subCommand === 'latex') {
            if (typeof sock.sendLatex === 'function') {
                return await sock.sendLatex(
                    chatId,
                    message,
                    {
                        formula: 'E = mc^2 \\quad \\Longleftrightarrow \\quad \\nabla \\times \\mathbf{B} = \\mu_0 \\mathbf{J} + \\mu_0 \\varepsilon_0 \\frac{\\partial \\mathbf{E}}{\\partial t}',
                        headerText: '🧮 Mathematical Physics Proof',
                        footer: 'PGWIZ-MD • LaTeX Client-Side Rendering'
                    }
                );
            }
            return await sock.sendMessage(chatId, { text: '⚠️ sock.sendLatex is not available on this socket.' }, { quoted: message });
        }

        // ==========================================
        // TEST CASE 13: Keith MD Combined Multi-Type Rich Message
        // ==========================================
        if (subCommand === '13' || subCommand === 'rich') {
            if (typeof sock.sendRichMessage === 'function') {
                return await sock.sendRichMessage(
                    chatId,
                    [
                        { type: 'text', text: '🤖 *PGWIZ-MD Meta AI UX Engine Demo*\nThis rich response chains multiple submessage blocks in a single payload:' },
                        { type: 'table', title: '📊 System Status', headers: ['Service', 'State'], rows: [['Signal Ratchet', 'Synced 🟢'], ['Memory Pool', 'Normal 🟢']] },
                        { type: 'code', language: 'python', code: 'def ping():\n    return "pong 🏓"' },
                        { type: 'list', title: '✨ Supported Primitives', items: ['Tables', 'Code Blocks', 'Lists', 'LaTeX', 'Link Cards'] },
                        { type: 'link', text: 'Explore more on GitHub:', links: [{ url: 'https://github.com/pgwiz/PGWIZ-MD', title: 'PGWIZ-MD' }] }
                    ],
                    message,
                    { footer: 'PGWIZ-MD • Combined AI Rich Message Engine' }
                );
            }
            return await sock.sendMessage(chatId, { text: '⚠️ sock.sendRichMessage is not available on this socket.' }, { quoted: message });
        }

        // ==========================================
        // TEST CASE 14: Keith MD Unified Response Echo
        // ==========================================
        if (subCommand === '14' || subCommand === 'unified') {
            if (typeof sock.sendUnifiedResponse === 'function') {
                const captured = typeof sock.captureUnifiedResponse === 'function' ? sock.captureUnifiedResponse(message) : {};
                return await sock.sendUnifiedResponse(
                    chatId,
                    message,
                    captured || { unifiedResponse: 'Echo Unified Response OK' }
                );
            }
            return await sock.sendMessage(chatId, { text: '⚠️ sock.sendUnifiedResponse is not available on this socket.' }, { quoted: message });
        }

        // ==========================================
        // DEFAULT: Master Showcase & Interactive Launcher
        // ==========================================
        const showcaseText = `🎛️ *CUSTOM BUTTONS & RICH MESSAGES TEST SUITE*\n\n` +
            `Choose a test case below to inspect WhatsApp UI primitives on your device:\n\n` +
            `*Native Flow Buttons:*\n` +
            `• *Case 1:* \`.testbtn 1\` - Quick Reply Buttons (Instant Command Callbacks)\n` +
            `• *Case 2:* \`.testbtn 2\` - Action Buttons (CTA URL & Copy Code)\n` +
            `• *Case 3:* \`.testbtn 3\` - Telephony Call Action Buttons\n` +
            `• *Case 4:* \`.testbtn 4\` - Full Hybrid Native Flow (All 4 Button Types)\n` +
            `• *Case 5:* \`.testbtn 5\` - Single Select List Menu (Dropdown Sections & Rows)\n` +
            `• *Case 6:* \`.testbtn 6\` - Classic ButtonV2 (buttonsMessage with Location Header)\n` +
            `• *Case 7:* \`.testbtn 7\` - Dynamic User-Defined Custom Buttons\n\n` +
            `*Keith MD AI Rich Messages:*\n` +
            `• *Case 8:* \`.testbtn 8\` - Rich Structured Table\n` +
            `• *Case 9:* \`.testbtn 9\` - Rich Bulleted List\n` +
            `• *Case 10:* \`.testbtn 10\` - Rich Code Block with Syntax Highlighting\n` +
            `• *Case 11:* \`.testbtn 11\` - Rich Interactive Link Cards\n` +
            `• *Case 12:* \`.testbtn 12\` - Rich LaTeX Mathematical Formula\n` +
            `• *Case 13:* \`.testbtn 13\` - Combined Multi-Type Rich Message\n` +
            `• *Case 14:* \`.testbtn 14\` - Unified Response Echo\n\n` +
            `_Tap any button below to launch a test immediately:_`;

        const masterPayload = {
            title: '🔘 NATIVE BUTTONS & RICH UI SUITE',
            subtitle: 'WhatsApp Flow & Meta AI Showcase',
            text: showcaseText,
            footer: 'PGWIZ-MD • Native Flow & Rich Engine',
            buttons: [
                {
                    type: 'quick_reply',
                    text: '⚡ Case 1: Quick Replies',
                    id: '.testbtn 1'
                },
                {
                    type: 'quick_reply',
                    text: '🌐 Case 2: URL & Copy',
                    id: '.testbtn 2'
                },
                {
                    type: 'quick_reply',
                    text: '⚡ Case 6: Classic V2',
                    id: '.testbtn 6'
                },
                {
                    type: 'quick_reply',
                    text: '📊 Case 8: Rich Table',
                    id: '.testbtn 8'
                },
                {
                    type: 'quick_reply',
                    text: '💻 Case 10: Rich Code',
                    id: '.testbtn 10'
                }
            ]
        };

        return await dispatchButtons(masterPayload);
    }
};
