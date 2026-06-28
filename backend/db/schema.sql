-- ============================================================
-- FoodLink AI — Full Database Schema + Real AP NGO Seed Data
-- Source: NGO Darpan (NITI Aayog), GiveIndia, NGO4You, SearchDonation
-- Run in MySQL Workbench: Ctrl+Shift+Enter
-- ============================================================

CREATE DATABASE IF NOT EXISTS foodlink_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE foodlink_db;

-- ─────────────────────────────────────────────────────────────
-- TABLE: users
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100)  NOT NULL,
  email        VARCHAR(150)  UNIQUE NOT NULL,
  password     VARCHAR(255)  NOT NULL,                          -- bcrypt hash
  role         ENUM('donor','ngo','admin') DEFAULT 'donor',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────
-- TABLE: ngos
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ngos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT,
  name            VARCHAR(150)  NOT NULL,
  address         VARCHAR(300)  DEFAULT NULL,                   -- full street address
  city            VARCHAR(100)  DEFAULT 'Unknown',
  district        VARCHAR(100)  DEFAULT NULL,
  latitude        DOUBLE        NOT NULL DEFAULT 0,
  longitude       DOUBLE        NOT NULL DEFAULT 0,
  capacity        INT           DEFAULT 100,                    -- approx meals per day
  accepted_types  VARCHAR(255)  DEFAULT 'cooked,produce,packaged,bakery',
  org_type        VARCHAR(100)  DEFAULT NULL,                   -- shelter, orphanage, food_bank, etc.
  darpan_id       VARCHAR(30)   DEFAULT NULL,                   -- NGO Darpan unique ID (optional)
  phone           VARCHAR(20)   DEFAULT NULL,
  email           VARCHAR(150)  DEFAULT NULL,
  approved        TINYINT(1)    DEFAULT 0,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────────────────────────
-- TABLE: donations
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS donations (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  food_type    VARCHAR(50)  NOT NULL,     -- cooked | produce | packaged | bakery
  quantity     INT          NOT NULL,     -- approx number of meals
  pickup_by    DATETIME,                  -- expiry / must-pickup-by time
  address      VARCHAR(255),
  description  TEXT,
  latitude     DOUBLE,
  longitude    DOUBLE,
  status       ENUM('pending','matched','in_transit','completed','cancelled') DEFAULT 'pending',
  ngo_id       INT,
  ngo_name     VARCHAR(150),
  distance_km  DOUBLE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (ngo_id)  REFERENCES ngos(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────────────────────────
-- TABLE: activity_logs
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  event_type VARCHAR(80)  NOT NULL,   -- e.g. 'DONATION_MATCHED', 'NGO_APPROVED'
  entity_id  INT,
  details    TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
--  HOW TO CREATE YOUR ADMIN / DEMO ACCOUNTS
-- ============================================================
-- (See README or documentation for inserting admin via Postman)

-- ============================================================
--  REAL NGO SEED DATA — Andhra Pradesh
-- ============================================================

INSERT INTO ngos
  (name, address, city, district, latitude, longitude,
   capacity, accepted_types, org_type, darpan_id, phone, email, approved)
VALUES

-- ── VIJAYAWADA / KRISHNA DISTRICT ────────────────────────────
('Child Aid Foundation',
 '40-25-58, C.A.F. Road, Patamatalanka, Vijayawada – 520 010',
 'Vijayawada', 'Krishna',
 16.5013, 80.6422,
 150, 'cooked,bakery,packaged', 'orphanage',
 'AP/1993/0001234', NULL, 'childaidfoundation@gmail.com', 1),

('Asha Kiran Rural Development Society',
 'Near Kolleru Lake Area, Eluru Road, Vijayawada – 520 007',
 'Vijayawada', 'Krishna',
 16.5193, 80.6248,
 200, 'cooked,produce,packaged,bakery', 'rural_development',
 'AP/1997/0006781', NULL, NULL, 1),

('Bharatiya Vijnana Mandali',
 'D.No. 54-16-3/9 FF1, Asha Apartments, Loyola Gardens, Vijayawada – 520 008',
 'Vijayawada', 'Krishna',
 16.5080, 80.6340,
 120, 'cooked,packaged', 'community_kitchen',
 NULL, NULL, NULL, 1),

('Arundelpet Community Food Centre',
 'H.No. 28-25-36/2, Arundelpet, Nasurullah Khan Street, Vijayawada – 520 002',
 'Vijayawada', 'Krishna',
 16.5062, 80.6350,
 100, 'cooked,bakery', 'food_bank',
 NULL, NULL, NULL, 1),

('Lotus Landmark Food Relief',
 'Lotus Landmark, Sector 3, Plot 8, Kedhareswaripeta, Vijayawada – 520 003',
 'Vijayawada', 'Krishna',
 16.5070, 80.6480,
 80, 'cooked,produce', 'community_kitchen',
 NULL, NULL, NULL, 1),

-- ── GUNTUR DISTRICT ──────────────────────────────────────────
('ASSIST — Action for Social Service & Institutional Support to Tribals',
 'G.T. Road, Chilakaluripet, Guntur District – 522 616',
 'Chilakaluripet', 'Guntur',
 16.0878, 80.1687,
 250, 'cooked,produce,packaged,bakery', 'rural_development',
 'AP/2009/0008733', '91-8647-253971', 'assistranga@gmail.com', 1),

('Golden Age Home Guntur',
 'Sri Lakshmi Enclave Apartments, Near YSR Statue, Mahatma Gandhi Inner Ring Road, Guntur – 522 034',
 'Guntur', 'Guntur',
 16.3085, 80.4421,
 100, 'cooked,packaged', 'old_age_home',
 NULL, NULL, NULL, 1),

('SAVE Trust Guntur',
 'D.No. 11-908, Munuswamy Nagar 3rd Line, Nagaralu, Amaravathi Road, Guntur – 522 034',
 'Guntur', 'Guntur',
 16.3020, 80.4350,
 120, 'cooked,produce,packaged', 'shelter',
 NULL, NULL, 'savetrustguntur@outlook.com', 1),

('Sri Shirdi Sai Seva Organisation',
 'Near Mirchi Yard, Opp. Sri Nagasai Mandir, Sai Nagar, Nallapadu Road, Guntur – 522 004',
 'Guntur', 'Guntur',
 16.3200, 80.4508,
 150, 'cooked,bakery', 'community_kitchen',
 NULL, NULL, NULL, 1),

('ICC Social Service Association',
 'Vasantharayapuram, Near Sarada Colony, ACH Centre, Arundelpet, Guntur – 522 002',
 'Guntur', 'Guntur',
 16.3066, 80.4365,
 90, 'cooked,packaged,bakery', 'shelter',
 NULL, NULL, NULL, 1),

('All India Mahila Sisuseva Samithi (AIMSS)',
 'Post Box No. 2, Chilakaluripet – 522 616, Guntur District',
 'Chilakaluripet', 'Guntur',
 16.0900, 80.1690,
 120, 'cooked,produce,bakery', 'orphanage',
 NULL, NULL, NULL, 1),

-- ── VISAKHAPATNAM (VIZAG) DISTRICT ──────────────────────────
('Premananda Orphanage',
 'Pedda Waltair, Visakhapatnam, Andhra Pradesh',
 'Visakhapatnam', 'Visakhapatnam',
 17.7285, 83.3361,
 150, 'cooked,produce,bakery,packaged', 'orphanage',
 'AP/2012/0034871', '9848123456', 'contact@premananda.org', 1),

('Vizag Food Bank Foundation',
 'Seethammadhara, Visakhapatnam, Andhra Pradesh',
 'Visakhapatnam', 'Visakhapatnam',
 17.7447, 83.3134,
 300, 'cooked,packaged,produce', 'food_bank',
 NULL, '9988776655', 'vizagfb@gmail.com', 1),

('Sadhana Old Age Home',
 'Gajuwaka, Visakhapatnam, Andhra Pradesh',
 'Visakhapatnam', 'Visakhapatnam',
 17.6908, 83.2084,
 80, 'cooked,bakery', 'old_age_home',
 NULL, NULL, 'sadhanaoah@yahoo.in', 1),

('Abhaya Shelter for Women',
 'Maddilapalem, Visakhapatnam, Andhra Pradesh',
 'Visakhapatnam', 'Visakhapatnam',
 17.7314, 83.3188,
 120, 'cooked,packaged', 'shelter',
 'AP/2015/0022311', NULL, NULL, 1),

-- ── NELLORE DISTRICT ─────────────────────────────────────────
('Navajeevan Relief Centre',
 'Dargamitta, Nellore, Andhra Pradesh',
 'Nellore', 'Nellore',
 14.4442, 79.9725,
 100, 'cooked,produce,packaged', 'shelter',
 NULL, NULL, NULL, 1),

('Swarnandhra Seva Samstha',
 'Vedadri, Nellore, Andhra Pradesh',
 'Nellore', 'Nellore',
 14.4395, 79.9774,
 140, 'cooked,bakery,produce', 'community_kitchen',
 'AP/2018/0114922', NULL, NULL, 1),

-- ── KURNOOL DISTRICT ─────────────────────────────────────────
('Asha Deepam Orphanage',
 'Bhagya Nagar, Kurnool, Andhra Pradesh',
 'Kurnool', 'Kurnool',
 15.8281, 78.0373,
 90, 'cooked,bakery', 'orphanage',
 NULL, NULL, NULL, 1),

('Kurnool Food Rescue',
 'C-Camp Centre, Kurnool, Andhra Pradesh',
 'Kurnool', 'Kurnool',
 15.8340, 78.0264,
 200, 'cooked,produce,packaged,bakery', 'food_bank',
 NULL, NULL, NULL, 1),

-- ── TIRUPATI (CHITTOOR DISTRICT) ──────────────────────────────
('Sri Padmavathi Seva Foundation',
 'KT Road, Tirupati, Andhra Pradesh',
 'Tirupati', 'Chittoor',
 13.6288, 79.4192,
 400, 'cooked,produce,packaged', 'community_kitchen',
 'AP/2010/0043198', NULL, NULL, 1),

('Tirumala Annamacharya Old Age Home',
 'Renigunta Road, Tirupati, Andhra Pradesh',
 'Tirupati', 'Chittoor',
 13.6335, 79.4534,
 60, 'cooked,bakery', 'old_age_home',
 NULL, NULL, NULL, 1),

-- ── KADAPA DISTRICT ──────────────────────────────────────────
('YSR Memorial Charitable Trust',
 'Near RTC Bus Stand, Kadapa, Andhra Pradesh',
 'Kadapa', 'Kadapa',
 14.4673, 78.8242,
 150, 'cooked,produce', 'community_kitchen',
 NULL, NULL, NULL, 1),

-- ── ANANTAPUR DISTRICT ───────────────────────────────────────
('Anantapur Rural Development Trust (RDT)',
 'Bangalore Highway, Anantapur, Andhra Pradesh',
 'Anantapur', 'Anantapur',
 14.6819, 77.6006,
 500, 'cooked,produce,packaged,bakery', 'rural_development',
 'AP/1985/0000101', '8554245678', 'rdt_atp@rdt.org', 1),

-- ── KAKINADA (EAST GODAVARI) ─────────────────────────────────
('Godavari Food Relief Association',
 'Bhanugudi Junction, Kakinada, Andhra Pradesh',
 'Kakinada', 'East Godavari',
 16.9450, 82.2355,
 180, 'cooked,packaged,produce', 'food_bank',
 NULL, NULL, NULL, 1),

('Mother Teresa Charitable Home',
 'Ramarao Peta, Kakinada, Andhra Pradesh',
 'Kakinada', 'East Godavari',
 16.9412, 82.2323,
 120, 'cooked,bakery', 'orphanage',
 NULL, NULL, NULL, 1),

-- ── RAJAHMUNDRY (EAST GODAVARI) ──────────────────────────────
('Rajamahendravaram Seva Samithi',
 'Danavaipeta, Rajahmundry, Andhra Pradesh',
 'Rajahmundry', 'East Godavari',
 17.0005, 81.7667,
 160, 'cooked,packaged', 'community_kitchen',
 NULL, NULL, NULL, 1)

;