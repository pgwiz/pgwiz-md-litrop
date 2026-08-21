# ❓ FAQ & Troubleshooting

### Q1: Why does my bot disconnect or say Status 440?
**Answer**: Status 440 means **Session Conflict**. Another terminal or cloud instance is currently connected with the same `SESSION_ID`. Stop other running instances before starting.

### Q2: Why is the bot not responding to my owner commands?
**Answer**: Make sure your phone number (including country code without + sign) is entered in `OWNER_NUMBER=254700000000` in your `.env` file.

### Q3: How do I ignore specific contacts from Auto Status?
**Answer**: Use the command:
```text
.autostatus ignore 254700000000
.autostatus unignore 254700000000
.autostatus ignored
```
