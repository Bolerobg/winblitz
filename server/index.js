const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_123');

const app = express();
const PORT = process.env.PORT || 3005;

// PostgreSQL Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@db:5432/winblitz?sslmode=disable'
});

app.use(cors());
app.use(express.json());

// Initialize Database
async function initDB() {
    let retries = 5;
    while (retries > 0) {
        try {
            const sqlPath = path.join(__dirname, 'database.sql');
            const sql = fs.readFileSync(sqlPath, 'utf8');
            await pool.query(sql);
            console.log("Database tables initialized successfully!");
            break;
        } catch (err) {
            console.error("Error running database initialization script, retrying in 2 seconds...", err.message);
            retries -= 1;
            if (retries === 0) console.error("Could not initialize database after multiple attempts.");
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}
initDB();

// Helper to format date
function getFormattedDate() {
    const now = new Date();
    return now.toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" }) + " - " + now.toLocaleDateString("bg-BG");
}

// Helper to generate promo code
function generatePromoCode() {
    return 'WIN-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Default quests builder
function buildDefaultQuests() {
    return [
        { id: "spin", desc: "Завъртете Колелото на Късмета", target: 1, current: 0, reward: 0.50, claimed: false },
        { id: "practice", desc: "Изиграйте 2 Тренировки", target: 2, current: 0, reward: 1.00, claimed: false },
        { id: "win", desc: "Спечелете 1 Реална Игра", target: 1, current: 0, reward: 1.50, claimed: false }
    ];
}

// SMTP Transporter Config
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587/25
    auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
    }
});

// Helper to send real verification email
async function sendVerificationEmail(toEmail, code) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log(`[SMTP SKIPPED] Missing SMTP credentials. Verification code for ${toEmail}: ${code}`);
        return false;
    }
    try {
        const mailOptions = {
            from: process.env.SMTP_FROM || `"WinBlitz Support" <${process.env.SMTP_USER}>`,
            to: toEmail,
            subject: 'Вашият код за верификация в WinBlitz ⚡',
            text: `Здравейте,\n\nВашият верификационен код за WinBlitz е: ${code}\n\nКодът е валиден за следващите 10 минути.\n\nПоздрави,\nЕкипът на WinBlitz`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e9e9e9; border-radius: 10px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #8b5cf6; font-size: 26px; margin: 0;">WinBlitz ⚡</h2>
                    </div>
                    <p style="font-size: 16px; color: #333; line-height: 1.5;">Здравейте,</p>
                    <p style="font-size: 16px; color: #333; line-height: 1.5;">Благодарим Ви за регистрацията в WinBlitz! Използвайте кода по-долу, за да верифицирате профила си:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <span style="font-size: 32px; font-weight: bold; color: #8b5cf6; letter-spacing: 4px; padding: 10px 20px; background-color: #f5f3ff; border: 1px dashed #8b5cf6; border-radius: 5px;">${code}</span>
                    </div>
                    <p style="font-size: 14px; color: #666; line-height: 1.5;">Ако не сте поискали този код, моля игнорирайте този имейл.</p>
                    <hr style="border: none; border-top: 1px solid #e9e9e9; margin: 30px 0;" />
                    <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">© 2026 WinBlitz. Всички права запазени.</p>
                </div>
            `
        };
        const info = await transporter.sendMail(mailOptions);
        console.log(`[SMTP SUCCESS] Verification email sent to ${toEmail}. Message ID: ${info.messageId}`);
        return true;
    } catch (err) {
        console.error(`[SMTP ERROR] Failed to send email to ${toEmail}:`, err);
        return false;
    }
}

// MiddleWare to fetch/authenticate user by email or phone header
app.use(async (req, res, next) => {
    const email = req.headers['x-user-email'];
    const phone = req.headers['x-user-phone'];
    
    if (email && email !== 'null' && email !== 'undefined' && email.trim() !== '') {
        try {
            const emailVal = email.trim().toLowerCase();
            let result = await pool.query('SELECT * FROM users WHERE email = $1', [emailVal]);
            if (result.rows.length > 0) {
                req.user = result.rows[0];
            } else {
                // Auto create unverified user
                const newUser = await pool.query(
                    `INSERT INTO users (email, balance, unlocked_avatars, unlocked_themes, daily_quests, promo_code) 
                     VALUES ($1, 100.00, ARRAY['👤'], ARRAY['default'], $2, $3) RETURNING *`,
                    [emailVal, JSON.stringify(buildDefaultQuests()), generatePromoCode()]
                );
                req.user = newUser.rows[0];
                
                // Initial bonus transaction
                await pool.query(
                    'INSERT INTO wallet_history (user_id, description, amount, type) VALUES ($1, $2, $3, $4)',
                    [req.user.id, "Начален бонус (Демо)", 100.00, "deposit"]
                );
            }
        } catch (err) {
            console.error("Middleware auth error (email):", err);
        }
    } else if (phone && phone !== 'null' && phone !== 'undefined' && phone.trim() !== '') {
        try {
            let result = await pool.query('SELECT * FROM users WHERE phone = $1', [phone.trim()]);
            if (result.rows.length > 0) {
                req.user = result.rows[0];
            } else {
                // Auto create unverified user
                const newUser = await pool.query(
                    `INSERT INTO users (phone, balance, unlocked_avatars, unlocked_themes, daily_quests, promo_code) 
                     VALUES ($1, 100.00, ARRAY['👤'], ARRAY['default'], $2, $3) RETURNING *`,
                    [phone.trim(), JSON.stringify(buildDefaultQuests()), generatePromoCode()]
                );
                req.user = newUser.rows[0];
                
                // Initial bonus transaction
                await pool.query(
                    'INSERT INTO wallet_history (user_id, description, amount, type) VALUES ($1, $2, $3, $4)',
                    [req.user.id, "Начален бонус (Демо)", 100.00, "deposit"]
                );
            }
        } catch (err) {
            console.error("Middleware auth error (phone):", err);
        }
    }
    if (req.user) {
        if (!req.user.unlocked_achievements || !Array.isArray(req.user.unlocked_achievements)) {
            req.user.unlocked_achievements = [];
        }
        if (!req.user.unlocked_avatars || !Array.isArray(req.user.unlocked_avatars)) {
            req.user.unlocked_avatars = ['👤'];
        }
        if (!req.user.unlocked_themes || !Array.isArray(req.user.unlocked_themes)) {
            req.user.unlocked_themes = ['default'];
        }
    }
    next();
});

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

function requireAdmin(req, res, next) {
    const authHeader = req.headers['x-admin-password'];
    if (authHeader === ADMIN_PASSWORD) {
        next();
    } else {
        res.status(403).json({ error: "Неразрешен достъп! Грешна администраторска парола." });
    }
}

// GET /api/user/state
app.get('/api/user/state', async (req, res) => {
    if (!req.user) {
        return res.json({ user: null, walletHistory: [], wonPrizes: [], completedGames: [] });
    }
    try {
        const walletResult = await pool.query('SELECT * FROM wallet_history WHERE user_id = $1 ORDER BY id DESC', [req.user.id]);
        const prizesResult = await pool.query('SELECT * FROM won_prizes WHERE user_id = $1 ORDER BY id DESC', [req.user.id]);
        const completedResult = await pool.query('SELECT * FROM completed_games ORDER BY id DESC');
        
        res.json({
            user: req.user,
            walletHistory: walletResult.rows,
            wonPrizes: prizesResult.rows,
            completedGames: completedResult.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// POST /api/auth/register-sms
app.post('/api/auth/register-sms', async (req, res) => {
    const { phone, fullname, city, address, referralCode } = req.body;
    if (!phone) return res.status(400).json({ error: "Missing phone" });
    
    try {
        const simulatedCode = Math.floor(1000 + Math.random() * 9000).toString();
        console.log(`[SMS SIMULATION] Code for ${phone}: ${simulatedCode}`);
        
        let referrerId = null;
        if (referralCode && referralCode.trim() !== '') {
            const referrerRes = await pool.query('SELECT id FROM users WHERE promo_code = $1', [referralCode.trim().toUpperCase()]);
            if (referrerRes.rows.length > 0) {
                referrerId = referrerRes.rows[0].id;
            }
        }

        let result = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
        let user;
        
        if (result.rows.length > 0) {
            // Update existing unverified account, also set referred_by if applicable and not already set
            const existingUser = result.rows[0];
            const finalReferrerId = existingUser.referred_by || referrerId;
            const updated = await pool.query(
                `UPDATE users SET fullname = $1, city = $2, address = $3, sms_code = $4, verified = FALSE, referred_by = $5 
                 WHERE phone = $6 RETURNING *`,
                [fullname, city, address, simulatedCode, finalReferrerId, phone]
            );
            user = updated.rows[0];
        } else {
            const inserted = await pool.query(
                `INSERT INTO users (phone, fullname, city, address, sms_code, balance, unlocked_avatars, unlocked_themes, daily_quests, promo_code, referred_by) 
                 VALUES ($1, $2, $3, $4, $5, 100.00, ARRAY['👤'], ARRAY['default'], $6, $7, $8) RETURNING *`,
                [phone, fullname, city, address, simulatedCode, JSON.stringify(buildDefaultQuests()), generatePromoCode(), referrerId]
            );
            user = inserted.rows[0];
            
            await pool.query(
                'INSERT INTO wallet_history (user_id, description, amount, type) VALUES ($1, $2, $3, $4)',
                [user.id, "Начален бонус (Демо)", 100.00, "deposit"]
            );
        }
        
        res.json({ success: true, code: simulatedCode, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// POST /api/auth/verify-sms
app.post('/api/auth/verify-sms', async (req, res) => {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ error: "Missing params" });
    
    try {
        const result = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
        if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
        
        const user = result.rows[0];
        if (user.sms_code === code) {
            const verifiedUser = await pool.query(
                'UPDATE users SET verified = TRUE, sms_code = NULL WHERE id = $1 RETURNING *',
                [user.id]
            );
            res.json({ success: true, user: verifiedUser.rows[0] });
        } else {
            res.status(400).json({ success: false, error: "Wrong code" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
    const { email, password, fullname, city, address, referralCode } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
    
    try {
        const emailVal = email.trim().toLowerCase();
        let result = await pool.query('SELECT * FROM users WHERE email = $1', [emailVal]);
        
        if (result.rows.length > 0) {
            // Unverified user might exist from middleware. Let's see if they have password.
            if (result.rows[0].password_hash) {
                return res.status(400).json({ error: "Потребител с този имейл вече съществува." });
            }
        }
        
        let referrerId = null;
        if (referralCode && referralCode.trim() !== '') {
            const referrerRes = await pool.query('SELECT id FROM users WHERE promo_code = $1', [referralCode.trim().toUpperCase()]);
            if (referrerRes.rows.length > 0) {
                referrerId = referrerRes.rows[0].id;
            }
        }
        
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        
        let user;
        if (result.rows.length > 0) {
            const existingUser = result.rows[0];
            const finalReferrerId = existingUser.referred_by || referrerId;
            const updated = await pool.query(
                `UPDATE users SET password_hash = $1, fullname = $2, city = $3, address = $4, verified = TRUE, referred_by = $5 
                 WHERE email = $6 RETURNING *`,
                [hash, fullname, city, address, finalReferrerId, emailVal]
            );
            user = updated.rows[0];
        } else {
            const inserted = await pool.query(
                `INSERT INTO users (email, password_hash, fullname, city, address, verified, balance, unlocked_avatars, unlocked_themes, daily_quests, promo_code, referred_by) 
                 VALUES ($1, $2, $3, $4, $5, TRUE, 100.00, ARRAY['👤'], ARRAY['default'], $6, $7, $8) RETURNING *`,
                [emailVal, hash, fullname, city, address, JSON.stringify(buildDefaultQuests()), generatePromoCode(), referrerId]
            );
            user = inserted.rows[0];
            
            await pool.query(
                'INSERT INTO wallet_history (user_id, description, amount, type) VALUES ($1, $2, $3, $4)',
                [user.id, "Начален бонус (Демо)", 100.00, "deposit"]
            );
        }
        
        res.json({ success: true, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
    
    try {
        const emailVal = email.trim().toLowerCase();
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [emailVal]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Грешен имейл или парола." });
        
        const user = result.rows[0];
        if (!user.password_hash) {
             return res.status(400).json({ error: "Този профил не е създаден с парола. Моля, свържете се с поддръжката." });
        }
        
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ error: "Грешен имейл или парола." });
        }
        
        res.json({ success: true, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// POST /api/auth/forgot-password
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Имейлът е задължителен." });

    try {
        const emailVal = email.trim().toLowerCase();
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [emailVal]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Няма регистриран потребител с този имейл." });
        }

        const resetCode = Math.floor(1000 + Math.random() * 9000).toString();
        
        await pool.query('UPDATE users SET reset_code = $1 WHERE email = $2', [resetCode, emailVal]);
        
        await sendVerificationEmail(emailVal, resetCode);
        
        res.json({ success: true, message: "Кодът за възстановяване е изпратен." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// POST /api/auth/reset-password
app.post('/api/auth/reset-password', async (req, res) => {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
        return res.status(400).json({ error: "Имейл, код и нова парола са задължителни." });
    }

    try {
        const emailVal = email.trim().toLowerCase();
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [emailVal]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Потребителят не е намерен." });
        }

        const user = result.rows[0];
        if (user.reset_code !== code) {
            return res.status(400).json({ error: "Невалиден код." });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);

        await pool.query('UPDATE users SET password_hash = $1, reset_code = NULL WHERE email = $2', [hash, emailVal]);

        res.json({ success: true, message: "Паролата е успешно променена." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// POST /api/user/update-address
app.post('/api/user/update-address', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { fullname, city, address } = req.body;
    try {
        const updated = await pool.query(
            'UPDATE users SET fullname = $1, city = $2, address = $3 WHERE id = $4 RETURNING *',
            [fullname, city, address, req.user.id]
        );
        res.json({ success: true, user: updated.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// POST /api/user/claim-quest
app.post('/api/user/claim-quest', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { questId } = req.body;
    
    try {
        let quests = typeof req.user.daily_quests === 'string' ? JSON.parse(req.user.daily_quests) : req.user.daily_quests;
        if (!quests || quests.length === 0) quests = buildDefaultQuests();
        
        const quest = quests.find(q => q.id === questId);
        if (!quest || quest.current < quest.target || quest.claimed) {
            return res.status(400).json({ error: "Quest not claimable" });
        }
        
        quest.claimed = true;
        const newBalance = parseFloat(req.user.balance) + quest.reward;
        
        // Save to DB
        const updated = await pool.query(
            'UPDATE users SET balance = $1, daily_quests = $2 WHERE id = $3 RETURNING *',
            [newBalance, JSON.stringify(quests), req.user.id]
        );
        
        await pool.query(
            'INSERT INTO wallet_history (user_id, description, amount, type) VALUES ($1, $2, $3, $4)',
            [req.user.id, `Награда от мисия: ${quest.desc}`, quest.reward, "deposit"]
        );
        
        // Auto check millionaire achievement
        let userState = updated.rows[0];
        const currentAchievements = userState.unlocked_achievements || [];
        if (newBalance >= 50.00 && !currentAchievements.includes('millionaire')) {
            const achievements = [...currentAchievements, 'millionaire'];
            const u = await pool.query('UPDATE users SET unlocked_achievements = $1 WHERE id = $2 RETURNING *', [achievements, req.user.id]);
            userState = u.rows[0];
        }
        
        res.json({ success: true, user: userState });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// POST /api/user/buy-avatar
app.post('/api/user/buy-avatar', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { avatar, price } = req.body;
    
    if (parseFloat(req.user.balance) < price) {
        return res.status(400).json({ error: "Insufficient balance" });
    }
    if (req.user.unlocked_avatars.includes(avatar)) {
        return res.status(400).json({ error: "Already unlocked" });
    }
    
    try {
        const newBalance = parseFloat(req.user.balance) - price;
        const unlockedAvatars = [...req.user.unlocked_avatars, avatar];
        
        let updated = await pool.query(
            'UPDATE users SET balance = $1, unlocked_avatars = $2 WHERE id = $3 RETURNING *',
            [newBalance, unlockedAvatars, req.user.id]
        );
        
        await pool.query(
            'INSERT INTO wallet_history (user_id, description, amount, type) VALUES ($1, $2, $3, $4)',
            [req.user.id, `Покупка на аватар: ${avatar}`, -price, "withdrawal"]
        );
        
        let userState = updated.rows[0];
        const currentAchievements = userState.unlocked_achievements || [];
        if (unlockedAvatars.length >= 3 && !currentAchievements.includes('collector')) {
            const achievements = [...currentAchievements, 'collector'];
            const u = await pool.query('UPDATE users SET unlocked_achievements = $1 WHERE id = $2 RETURNING *', [achievements, req.user.id]);
            userState = u.rows[0];
        }
        
        res.json({ success: true, user: userState });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// POST /api/user/buy-theme
app.post('/api/user/buy-theme', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { themeId, price, themeName } = req.body;
    
    if (parseFloat(req.user.balance) < price) {
        return res.status(400).json({ error: "Insufficient balance" });
    }
    if (req.user.unlocked_themes.includes(themeId)) {
        return res.status(400).json({ error: "Already unlocked" });
    }
    
    try {
        const newBalance = parseFloat(req.user.balance) - price;
        const unlockedThemes = [...req.user.unlocked_themes, themeId];
        
        const updated = await pool.query(
            'UPDATE users SET balance = $1, unlocked_themes = $2 WHERE id = $3 RETURNING *',
            [newBalance, unlockedThemes, req.user.id]
        );
        
        await pool.query(
            'INSERT INTO wallet_history (user_id, description, amount, type) VALUES ($1, $2, $3, $4)',
            [req.user.id, `Покупка на тема: ${themeName}`, -price, "withdrawal"]
        );
        
        res.json({ success: true, user: updated.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// POST /api/user/select-avatar
app.post('/api/user/select-avatar', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { avatar } = req.body;
    if (!req.user.unlocked_avatars.includes(avatar)) {
        return res.status(400).json({ error: "Avatar not unlocked" });
    }
    try {
        const updated = await pool.query('UPDATE users SET active_avatar = $1 WHERE id = $2 RETURNING *', [avatar, req.user.id]);
        res.json({ success: true, user: updated.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// POST /api/user/select-theme
app.post('/api/user/select-theme', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { themeId } = req.body;
    if (!req.user.unlocked_themes.includes(themeId)) {
        return res.status(400).json({ error: "Theme not unlocked" });
    }
    try {
        const updated = await pool.query('UPDATE users SET active_theme = $1 WHERE id = $2 RETURNING *', [themeId, req.user.id]);
        res.json({ success: true, user: updated.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// POST /api/user/open-lootbox
app.post('/api/user/open-lootbox', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (req.user.loot_boxes_owned <= 0) return res.status(400).json({ error: "No loot boxes" });
    
    try {
        const rand = Math.random();
        let rewardText = "";
        let newBalance = parseFloat(req.user.balance);
        let unlockedAvatars = [...req.user.unlocked_avatars];
        const newLootBoxes = req.user.loot_boxes_owned - 1;
        
        if (rand < 0.60) {
            const amounts = [0.50, 1.00, 2.00, 5.00];
            const amount = amounts[Math.floor(Math.random() * amounts.length)];
            newBalance += amount;
            
            await pool.query(
                'INSERT INTO wallet_history (user_id, description, amount, type) VALUES ($1, $2, $3, $4)',
                [req.user.id, "Награда от Мистериозна Кутия 🎁", amount, "deposit"]
            );
            rewardText = `🎉 Спечелихте допълнителен баланс от <strong>€${amount.toFixed(2)}</strong>!`;
        } else {
            const avs = ["🦊", "🐯", "🐼", "👾", "🚀", "💎", "🐉"];
            const possibleAvs = avs.filter(a => !unlockedAvatars.includes(a));
            
            if (possibleAvs.length > 0) {
                const newAv = possibleAvs[Math.floor(Math.random() * possibleAvs.length)];
                unlockedAvatars.push(newAv);
                rewardText = `🎉 Отключихте нов уникален аватар: <span style="font-size: 24px; vertical-align: middle;">${newAv}</span>! Можете да го сложите от профила си.`;
            } else {
                const amount = 3.00;
                newBalance += amount;
                await pool.query(
                    'INSERT INTO wallet_history (user_id, description, amount, type) VALUES ($1, $2, $3, $4)',
                    [req.user.id, "Награда от Мистериозна Кутия 🎁", amount, "deposit"]
                );
                rewardText = `🎉 Тъй като имате всички аватари, получихте <strong>€${amount.toFixed(2)}</strong> баланс!`;
            }
        }
        
        let updated = await pool.query(
            'UPDATE users SET balance = $1, unlocked_avatars = $2, loot_boxes_owned = $3 WHERE id = $4 RETURNING *',
            [newBalance, unlockedAvatars, newLootBoxes, req.user.id]
        );
        
        let userState = updated.rows[0];
        const currentAchievements = userState.unlocked_achievements || [];
        if (newBalance >= 50.00 && !currentAchievements.includes('millionaire')) {
            const achievements = [...currentAchievements, 'millionaire'];
            const u = await pool.query('UPDATE users SET unlocked_achievements = $1 WHERE id = $2 RETURNING *', [achievements, req.user.id]);
            userState = u.rows[0];
        }
        if (unlockedAvatars.length >= 3 && !currentAchievements.includes('collector')) {
            const achievements = [...currentAchievements, 'collector'];
            const u = await pool.query('UPDATE users SET unlocked_achievements = $1 WHERE id = $2 RETURNING *', [achievements, req.user.id]);
            userState = u.rows[0];
        }
        
        res.json({ success: true, rewardText, user: userState });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// POST /api/user/simulate-new-day
app.post('/api/user/simulate-new-day', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    try {
        const updated = await pool.query(
            'UPDATE users SET daily_quests = $1, last_spin_date = NULL WHERE id = $2 RETURNING *',
            [JSON.stringify(buildDefaultQuests()), req.user.id]
        );
        res.json({ success: true, user: updated.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// POST /api/user/reset-state
app.post('/api/user/reset-state', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    try {
        // Clear history & won prizes
        await pool.query('DELETE FROM wallet_history WHERE user_id = $1', [req.user.id]);
        await pool.query('DELETE FROM won_prizes WHERE user_id = $1', [req.user.id]);
        
        // Reset user columns
        const updated = await pool.query(
            `UPDATE users SET balance = 100.00, xp = 0, clan_id = NULL, active_avatar = '👤', 
             active_theme = 'default', unlocked_avatars = ARRAY['👤'], unlocked_themes = ARRAY['default'], 
             loot_boxes_owned = 0, unlocked_achievements = ARRAY[]::TEXT[], daily_quests = $1,
             fullname = NULL, city = NULL, address = NULL, verified = FALSE, last_spin_date = NULL 
             WHERE id = $2 RETURNING *`,
            [JSON.stringify(buildDefaultQuests()), req.user.id]
        );
        
        // Add default transaction
        await pool.query(
            'INSERT INTO wallet_history (user_id, description, amount, type) VALUES ($1, $2, $3, $4)',
            [req.user.id, "Начален бонус (Демо)", 100.00, "deposit"]
        );
        
        res.json({ success: true, user: updated.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// GET /api/lobbies
app.get('/api/lobbies', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM lobbies ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// POST /api/lobbies/join
app.post('/api/lobbies/join', async (req, res) => {
    const { lobbyId } = req.body;
    const isPractice = req.body.isPractice === true || req.body.isPractice === 'true';
    if (!lobbyId) return res.status(400).json({ error: "Missing lobbyId" });
    
    try {
        const result = await pool.query('SELECT * FROM lobbies WHERE id = $1', [lobbyId]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Lobby not found" });
        
        const lobby = result.rows[0];
        const ticketPrice = parseFloat(lobby.ticket_price);
        
        let newBalance = req.user ? parseFloat(req.user.balance) : 0;
        let newLootBoxes = req.user ? req.user.loot_boxes_owned : 0;
        
        if (!isPractice && req.user) {
            if (newBalance < ticketPrice) {
                return res.status(400).json({ error: "Insufficient balance" });
            }
            newBalance -= ticketPrice;
            newLootBoxes += 1;
            
            // Deduct balance
            await pool.query('UPDATE users SET balance = $1, loot_boxes_owned = $2 WHERE id = $3', [newBalance, newLootBoxes, req.user.id]);
            
            // Add wallet entry
            await pool.query(
                'INSERT INTO wallet_history (user_id, description, amount, type) VALUES ($1, $2, $3, $4)',
                [req.user.id, `Вход за турнир: ${lobby.prize_name}`, -ticketPrice, "withdrawal"]
            );
        }
        
        // Add user to players list in lobby
        const players = typeof lobby.players === 'string' ? JSON.parse(lobby.players) : lobby.players || [];
        const isMeAlreadyJoined = players.some(p => p.isMe);
        
        if (!isMeAlreadyJoined) {
            players.push({
                name: "Вие (Участник)",
                isMe: true,
                time: null,
                errors: 0,
                finished: false
            });
        }
        
        const updatedLobby = await pool.query(
            'UPDATE lobbies SET players = $1, status = $2, is_practice = $3 WHERE id = $4 RETURNING *',
            [JSON.stringify(players), 'playing', isPractice, lobbyId]
        );
        
        res.json({
            success: true,
            lobby: updatedLobby.rows[0],
            user: req.user ? { ...req.user, balance: newBalance, loot_boxes_owned: newLootBoxes } : null
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// POST /api/lobbies/bot-join
app.post('/api/lobbies/bot-join', async (req, res) => {
    const { lobbyId, botName } = req.body;
    try {
        const result = await pool.query('SELECT * FROM lobbies WHERE id = $1', [lobbyId]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Lobby not found" });
        
        const lobby = result.rows[0];
        const players = typeof lobby.players === 'string' ? JSON.parse(lobby.players) : lobby.players || [];
        
        if (players.length < lobby.max_players) {
            players.push({
                name: botName,
                isMe: false,
                time: null,
                errors: 0,
                finished: false
            });
        }
        
        const updated = await pool.query(
            'UPDATE lobbies SET players = $1 WHERE id = $2 RETURNING *',
            [JSON.stringify(players), lobbyId]
        );
        res.json({ success: true, lobby: updated.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// POST /api/lobbies/create-duel
app.post('/api/lobbies/create-duel', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { gameType, entryFee } = req.body;
    const isPractice = req.body.isPractice === true || req.body.isPractice === 'true';
    
    try {
        const bet = parseFloat(entryFee);
        const prizeValue = bet * 1.8;
        
        let newBalance = parseFloat(req.user.balance);
        if (!isPractice) {
            if (newBalance < bet) {
                return res.status(400).json({ error: "Insufficient balance" });
            }
            newBalance -= bet;
            
            // Deduct
            await pool.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, req.user.id]);
            await pool.query(
                'INSERT INTO wallet_history (user_id, description, amount, type) VALUES ($1, $2, $3, $4)',
                [req.user.id, `Создаване на стая за Частен дуел`, -bet, "withdrawal"]
            );
        }
        
        // Create new dynamic duel lobby
        const result = await pool.query(
            `INSERT INTO lobbies (prize_name, prize_value, ticket_price, max_players, product_type, game_type, image, status, players, is_friend_duel, is_practice) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10) RETURNING *`,
            [
                `Частен дуел (${gameType})`,
                prizeValue,
                bet,
                2,
                "duel",
                gameType,
                "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop",
                "waiting",
                JSON.stringify([{ name: "Вие (Участник)", isMe: true, time: null, errors: 0, finished: false }]),
                isPractice
            ]
        );
        
        res.json({
            success: true,
            lobby: result.rows[0],
            user: { ...req.user, balance: newBalance }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// POST /api/lobbies/finish
app.post('/api/lobbies/finish', async (req, res) => {
    const { lobbyId, finalTime, errors } = req.body;
    if (!lobbyId) return res.status(400).json({ error: "Missing lobbyId" });
    
    try {
        const result = await pool.query('SELECT * FROM lobbies WHERE id = $1', [lobbyId]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Lobby not found" });
        
        const lobby = result.rows[0];
        let players = typeof lobby.players === 'string' ? JSON.parse(lobby.players) : lobby.players || [];
        
        // 1. Submit my results
        const me = players.find(p => p.isMe);
        if (me) {
            me.time = parseFloat(finalTime);
            me.errors = parseInt(errors);
            me.finished = true;
        }
        
        // 2. Simulate bot times
        players.forEach(p => {
            if (!p.isMe) {
                const botBaseTime = (Math.random() * 3.5 + 4.2).toFixed(2);
                const botErrors = Math.floor(Math.random() * 2);
                const botPenalty = botErrors * 3;
                p.time = parseFloat(botBaseTime) + botPenalty;
                p.errors = botErrors;
                p.finished = true;
            }
        });
        
        // Sort players by time
        const sorted = [...players].sort((a, b) => a.time - b.time);
        const winnerName = sorted[0].name === "Вие (Участник)" ? "Вие" : sorted[0].name;
        
        const completedAtText = getFormattedDate();
        const archiveId = Date.now();
        const isPracticeGame = lobby.is_practice;
        const isDuelGame = lobby.is_friend_duel;
        
        // 3. Save completed game
        await pool.query(
            `INSERT INTO completed_games (lobby_id, prize_name, prize_value, ticket_price, max_players, winner, completed_at, players, is_practice, is_friend_duel, archive_id, product_url, product_type, image, delivery_status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [
                lobby.id,
                lobby.prize_name,
                lobby.prize_value,
                lobby.ticket_price,
                lobby.max_players,
                winnerName,
                completedAtText,
                JSON.stringify(players),
                isPracticeGame,
                isDuelGame,
                archiveId,
                lobby.product_url,
                lobby.product_type,
                lobby.image,
                isDuelGame ? 'pending' : (winnerName === 'Вие' ? 'pending' : 'pending')
            ]
        );
        
        // 4. Update user state (if verified/authorized)
        let userState = req.user;
        if (userState && me) {
            let xpGained = 0;
            let balanceCredit = 0;
            
            let quests = typeof userState.daily_quests === 'string' ? JSON.parse(userState.daily_quests) : userState.daily_quests;
            if (!quests || quests.length === 0) quests = buildDefaultQuests();
            
            if (isPracticeGame) {
                xpGained = 10;
                // Increment practice quest
                const q = quests.find(item => item.id === 'practice');
                if (q && !q.claimed) q.current = Math.min(q.target, q.current + 1);
            } else if (isDuelGame) {
                xpGained = (winnerName === "Вие") ? 150 : 70;
                if (winnerName === "Вие") {
                    balanceCredit = parseFloat(lobby.prize_value);
                }
            } else {
                xpGained = (winnerName === "Вие") ? 150 : 50;
                if (winnerName === "Вие") {
                    // Increment win quest
                    const q = quests.find(item => item.id === 'win');
                    if (q && !q.claimed) q.current = Math.min(q.target, q.current + 1);
                }
            }
            
            // Adjust balances
            const newXP = userState.xp + xpGained;
            let newBalance = parseFloat(userState.balance);
            
            if (balanceCredit > 0) {
                newBalance += balanceCredit;
                await pool.query(
                    'INSERT INTO wallet_history (user_id, description, amount, type) VALUES ($1, $2, $3, $4)',
                    [userState.id, `Спечелен Частен дуел (${lobby.prize_name}) 🏆`, balanceCredit, "deposit"]
                );
            }
            
            // Unlocks Achievements Checks
            let achievements = Array.isArray(userState.unlocked_achievements) ? [...userState.unlocked_achievements] : [];
            if (winnerName === "Вие" && !isPracticeGame) {
                // Speed check (<12s)
                if (parseFloat(finalTime) < 12.00 && !achievements.includes('speed')) {
                    achievements.push('speed');
                }
                // Flawless check (0 errors)
                if (parseInt(errors) === 0 && !achievements.includes('flawless')) {
                    achievements.push('flawless');
                }
            }
            if (newBalance >= 50.00 && !achievements.includes('millionaire')) {
                achievements.push('millionaire');
            }
            
            // Save Material Prize to won_prizes if I won a tournament
            if (winnerName === "Вие" && !isPracticeGame && !isDuelGame) {
                await pool.query(
                    `INSERT INTO won_prizes (user_id, prize_name, prize_value, delivery_status, archive_id) 
                     VALUES ($1, $2, $3, 'pending', $4)`,
                    [userState.id, lobby.prize_name, lobby.prize_value, archiveId]
                );
            }
            
            // ---------------- STREAK LOGIC ---------------- //
            let currentStreak = parseInt(userState.streak_count) || 0;
            let lastPlayed = userState.last_played_date;
            
            if (!isPracticeGame && me) {
                const todayStr = new Date().toDateString();
                if (lastPlayed !== todayStr) {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yesterdayStr = yesterday.toDateString();
                    
                    if (lastPlayed === yesterdayStr) {
                        currentStreak += 1;
                    } else {
                        currentStreak = 1; // reset streak
                    }
                    
                    lastPlayed = todayStr;
                    
                    // Streak reward every 7 days
                    if (currentStreak > 0 && currentStreak % 7 === 0) {
                        newBalance += 2.00;
                        await pool.query(
                            'INSERT INTO wallet_history (user_id, description, amount, type) VALUES ($1, $2, $3, $4)',
                            [userState.id, `🔥 ${currentStreak}-дневен Streak Бонус`, 2.00, "deposit"]
                        );
                    }
                }
            }
            // ---------------------------------------------- //

            // Update User DB
            const userUpdated = await pool.query(
                `UPDATE users SET balance = $1, xp = $2, unlocked_achievements = $3, daily_quests = $4, last_played_date = $5, streak_count = $6 
                 WHERE id = $7 RETURNING *`,
                [newBalance, newXP, achievements, JSON.stringify(quests), lastPlayed, currentStreak, userState.id]
            );
            userState = userUpdated.rows[0];
        }
        
        // 5. Clean up/Reset active lobby state
        if (isDuelGame) {
            // Delete friend duel room
            await pool.query('DELETE FROM lobbies WHERE id = $1', [lobby.id]);
        } else {
            // Reset tournament back to waiting with fresh bots
            const startBotsCount = Math.floor(Math.random() * 3);
            const botNames = ["Христо В.", "Иван П.", "Мартин С.", "Теодора А.", "Стефан Р."];
            const freshPlayers = [];
            for (let i = 0; i < startBotsCount; i++) {
                freshPlayers.push({ name: botNames[i], isMe: false, time: null, errors: 0, finished: false });
            }
            await pool.query(
                'UPDATE lobbies SET players = $1, status = $2, winner = NULL WHERE id = $3',
                [JSON.stringify(freshPlayers), 'waiting', lobby.id]
            );
        }
        
        res.json({
            success: true,
            winner: winnerName,
            finalLobbyState: { ...lobby, players, winner: winnerName, status: "finished" },
            user: userState
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// POST /api/user/join-clan
app.post('/api/user/join-clan', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { clanId } = req.body;
    try {
        const updated = await pool.query('UPDATE users SET clan_id = $1 WHERE id = $2 RETURNING *', [clanId, req.user.id]);
        res.json({ success: true, user: updated.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// POST /api/user/leave-clan
app.post('/api/user/leave-clan', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    try {
        const updated = await pool.query('UPDATE users SET clan_id = NULL WHERE id = $1 RETURNING *', [req.user.id]);
        res.json({ success: true, user: updated.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// POST /api/user/simulate-spin
app.post('/api/user/simulate-spin', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    
    try {
        let quests = typeof req.user.daily_quests === 'string' ? JSON.parse(req.user.daily_quests) : req.user.daily_quests;
        if (!quests || quests.length === 0) quests = buildDefaultQuests();
        
        // Increment spin quest
        const q = quests.find(item => item.id === 'spin');
        if (q && !q.claimed) q.current = Math.min(q.target, q.current + 1);
        
        const updated = await pool.query(
            'UPDATE users SET daily_quests = $1 WHERE id = $2 RETURNING *',
            [JSON.stringify(quests), req.user.id]
        );
        res.json({ success: true, user: updated.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// POST /api/user/lucky-spin
app.post('/api/user/lucky-spin', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { rewardType, rewardVal, rewardName, spinDate } = req.body;
    
    try {
        let newBalance = parseFloat(req.user.balance);
        let lastSpinDate = req.user.last_spin_date;
        
        if (rewardType === 'cash') {
            newBalance += parseFloat(rewardVal);
            await pool.query(
                'INSERT INTO wallet_history (user_id, description, amount, type) VALUES ($1, $2, $3, $4)',
                [req.user.id, `Ежедневен бонус колело: ${rewardName}`, rewardVal, "deposit"]
            );
            lastSpinDate = spinDate;
        } else if (rewardType === 'wallpaper') {
            await pool.query(
                'INSERT INTO wallet_history (user_id, description, amount, type) VALUES ($1, $2, $3, $4)',
                [req.user.id, `Ежедневен бонус колело: Premium Тапет (HD) [Изтегли]`, 0, "deposit"]
            );
            lastSpinDate = spinDate;
        }
        
        // Update quest
        let quests = typeof req.user.daily_quests === 'string' ? JSON.parse(req.user.daily_quests) : req.user.daily_quests;
        if (!quests || quests.length === 0) quests = buildDefaultQuests();
        const q = quests.find(item => item.id === 'spin');
        if (q && !q.claimed) q.current = Math.min(q.target, q.current + 1);
        
        let achievements = Array.isArray(req.user.unlocked_achievements) ? [...req.user.unlocked_achievements] : [];
        if (newBalance >= 50.00 && !achievements.includes('millionaire')) {
            achievements.push('millionaire');
        }
        
        const updated = await pool.query(
            `UPDATE users SET balance = $1, last_spin_date = $2, daily_quests = $3, unlocked_achievements = $4 
             WHERE id = $5 RETURNING *`,
            [newBalance, lastSpinDate, JSON.stringify(quests), achievements, req.user.id]
        );
        res.json({ success: true, user: updated.rows[0] });
    } catch (err) {
        console.error("lucky-spin error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// POST /api/admin/create-lobby
app.post('/api/admin/create-lobby', requireAdmin, async (req, res) => {
    const { prizeName, prizeValue, ticketPrice, maxPlayers, productType, gameType, image, productUrl } = req.body;
    try {
        const max = parseInt(maxPlayers);
        const startBotsCount = Math.min(max - 2, Math.floor(Math.random() * 3));
        const botNames = ["Христо В.", "Иван П.", "Мартин С.", "Теодора А.", "Стефан Р.", "Мария Г."];
        const initialPlayers = [];
        for (let i = 0; i < startBotsCount; i++) {
            initialPlayers.push({
                name: botNames[i],
                isMe: false,
                time: null,
                errors: 0,
                finished: false
            });
        }
        
        const result = await pool.query(
            `INSERT INTO lobbies (prize_name, prize_value, ticket_price, max_players, product_type, game_type, image, product_url, status, players) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'waiting', $9) RETURNING *`,
            [prizeName, prizeValue, ticketPrice, maxPlayers, productType, gameType, image, productUrl, JSON.stringify(initialPlayers)]
        );
        res.json({ success: true, lobby: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// POST /api/admin/mark-shipped
app.post('/api/admin/mark-shipped', requireAdmin, async (req, res) => {
    const { archiveId } = req.body;
    try {
        await pool.query("UPDATE won_prizes SET delivery_status = 'shipped' WHERE archive_id = $1", [archiveId]);
        await pool.query("UPDATE completed_games SET delivery_status = 'shipped', players = jsonb_set(players, '{0,deliveryStatus}', '\"shipped\"') WHERE archive_id = $1", [archiveId]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// POST /api/admin/reset-all
app.post('/api/admin/reset-all', requireAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM wallet_history');
        await pool.query('DELETE FROM won_prizes');
        await pool.query('DELETE FROM completed_games');
        await pool.query('DELETE FROM lobbies');
        await pool.query('DELETE FROM users');
        
        // Reseed default lobbies
        const sqlPath = path.join(__dirname, 'database.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await pool.query(sql);
        
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Server error" });
    }
});

// ---------------- STRIPE & PAYMENTS ----------------
app.post('/api/payment/create-intent', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Неоторизиран достъп" });
    const { amount } = req.body;
    if (!amount || amount < 5) return res.status(400).json({ error: "Минималната сума за депозит е €5.00" });

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency: 'eur',
            automatic_payment_methods: {
                enabled: true,
            },
        });
        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (err) {
        console.error("Stripe create intent error:", err);
        res.status(500).json({ error: "Грешка при комуникация със Stripe." });
    }
});

app.post('/api/payment/confirm-deposit', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Неоторизиран достъп" });
    const { amount } = req.body;
    
    try {
        await pool.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [amount, req.user.id]);
        await pool.query(
            'INSERT INTO wallet_history (user_id, description, amount, type) VALUES ($1, $2, $3, $4)',
            [req.user.id, `Депозит чрез Stripe`, amount, "deposit"]
        );
        
        // Referral Bonus Logic
        if (amount >= 10 && req.user.referred_by && !req.user.referral_bonus_paid) {
            // Give 5 eur to the new user
            await pool.query('UPDATE users SET balance = balance + 5, referral_bonus_paid = TRUE WHERE id = $1', [req.user.id]);
            await pool.query(
                'INSERT INTO wallet_history (user_id, description, amount, type) VALUES ($1, $2, $3, $4)',
                [req.user.id, "Реферален бонус (Ти използва код)", 5.00, "deposit"]
            );
            
            // Give 5 eur to the referrer
            await pool.query('UPDATE users SET balance = balance + 5 WHERE id = $1', [req.user.referred_by]);
            await pool.query(
                'INSERT INTO wallet_history (user_id, description, amount, type) VALUES ($1, $2, $3, $4)',
                [req.user.referred_by, `Реферален бонус (Поканен приятел депозира)`, 5.00, "deposit"]
            );
        }
        
        const updatedUser = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        res.json({ success: true, user: updatedUser.rows[0] });
    } catch (err) {
        console.error("Confirm deposit error:", err);
        res.status(500).json({ error: "Грешка при запазване на депозита." });
    }
});

app.post('/api/payment/withdraw', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Неоторизиран достъп" });
    const { amount, iban } = req.body;
    
    if (!amount || amount < 20) return res.status(400).json({ error: "Минималната сума за теглене е €20.00" });
    if (!iban || iban.trim().length < 10) return res.status(400).json({ error: "Моля, въведете валиден IBAN." });

    if (parseFloat(req.user.balance) < parseFloat(amount)) {
        return res.status(400).json({ error: "Нямате достатъчно средства за това теглене." });
    }

    try {
        // Subtract from balance immediately
        await pool.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [amount, req.user.id]);
        
        // Insert withdrawal request
        await pool.query(
            'INSERT INTO withdrawals (user_id, amount, status, iban) VALUES ($1, $2, $3, $4)',
            [req.user.id, amount, 'pending', iban]
        );
        
        // Insert wallet history
        await pool.query(
            'INSERT INTO wallet_history (user_id, description, amount, type) VALUES ($1, $2, $3, $4)',
            [req.user.id, `Заявка за теглене към IBAN`, -amount, "withdrawal"]
        );

        const updatedUser = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        res.json({ success: true, user: updatedUser.rows[0] });
    } catch (err) {
        console.error("Withdrawal error:", err);
        res.status(500).json({ error: "Възникна грешка при обработка на заявката." });
    }
});

app.get('/api/user/withdrawals', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Неоторизиран достъп" });

    try {
        const result = await pool.query('SELECT * FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
        res.json({ success: true, withdrawals: result.rows });
    } catch (err) {
        console.error("Fetch user withdrawals error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

app.get('/api/admin/withdrawals', async (req, res) => {
    const adminPassword = req.headers['x-admin-password'];
    if (adminPassword !== 'admin1234') {
        return res.status(403).json({ error: "Грешна парола!" });
    }

    try {
        const result = await pool.query(`
            SELECT w.*, u.fullname, u.email, u.phone 
            FROM withdrawals w 
            JOIN users u ON w.user_id = u.id 
            ORDER BY w.created_at DESC
        `);
        res.json({ success: true, withdrawals: result.rows });
    } catch (err) {
        console.error("Fetch withdrawals error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/api/admin/withdrawal/approve', async (req, res) => {
    const adminPassword = req.headers['x-admin-password'];
    if (adminPassword !== 'admin1234') {
        return res.status(403).json({ error: "Грешна парола!" });
    }

    const { id } = req.body;
    try {
        await pool.query("UPDATE withdrawals SET status = 'approved' WHERE id = $1", [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/api/admin/withdrawal/reject', async (req, res) => {
    const adminPassword = req.headers['x-admin-password'];
    if (adminPassword !== 'admin1234') {
        return res.status(403).json({ error: "Грешна парола!" });
    }

    const { id } = req.body;
    try {
        const wResult = await pool.query("SELECT * FROM withdrawals WHERE id = $1", [id]);
        if (wResult.rows.length === 0) return res.status(404).json({ error: "Not found" });
        
        const w = wResult.rows[0];
        if (w.status !== 'pending') return res.status(400).json({ error: "Already processed" });

        // Reject and refund balance
        await pool.query("UPDATE withdrawals SET status = 'rejected' WHERE id = $1", [id]);
        await pool.query("UPDATE users SET balance = balance + $1 WHERE id = $2", [w.amount, w.user_id]);
        await pool.query(
            'INSERT INTO wallet_history (user_id, description, amount, type) VALUES ($1, $2, $3, $4)',
            [w.user_id, `Отхвърлено теглене (Възстановени средства)`, w.amount, "deposit"]
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});
// ---------------------------------------------------
// Automatic Freeroll Task
// Checks every minute if there's an active Freeroll. If not, creates one.
setInterval(async () => {
    try {
        const res = await pool.query(`
            SELECT COUNT(*) FROM lobbies 
            WHERE ticket_price = 0 AND is_practice = FALSE AND is_friend_duel = FALSE
        `);
        if (parseInt(res.rows[0].count) === 0) {
            console.log("No active Freeroll found. Creating a new one...");
            const insertQuery = `
                INSERT INTO lobbies (prize_name, prize_value, ticket_price, max_players, is_practice, status, players, image, product_url, product_type)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `;
            await pool.query(insertQuery, [
                "Дневен Freeroll Бонус 💶", 
                5.00, 
                0.00, 
                50, 
                false, 
                'waiting', 
                JSON.stringify([]), 
                null, 
                null, 
                'money'
            ]);
            console.log("Auto-created daily Freeroll tournament.");
        }
    } catch (err) {
        console.error("Auto Freeroll Task Error:", err);
    }
}, 60 * 1000); // Check every 60 seconds

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..')));

// Fallback to index.html for clientside router links (if any)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

app.listen(PORT, () => {
    console.log(`WinBlitz Express Server is running on port ${PORT}`);
});
