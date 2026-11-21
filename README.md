# ระบบเช็คยอดและนับจำนวนนักเรียนหอพัก (Student Counting System)

ระบบบริหารจัดการและเช็คยอดนักเรียนหอพักประจำ พัฒนาด้วย **React 18 + TypeScript + Vite + Tailwind CSS** พร้อมระบบฐานข้อมูลกลางและการควบคุมสิทธิ์ผู้ใช้งานหลายระดับ

---

## 🌟 คุณสมบัติหลักของระบบ (Key Features)

1. **การเช็คยอดประจำวัน (Daily Student Attendance)**
   - เช็คยอดนักเรียนจำแนกตามหอพัก (หอพัก 1 - 6)
   - สรุปจำนวนนักเรียน: อยู่หอพัก, ลากลับบ้าน, ป่วย, ทำกิจกรรม, ขาด/ติดต่อไม่ได้
2. **ระบบจัดการฐานข้อมูลกลาง (Central Database Management)**
   - บันทึก อ่าน และแก้ไขข้อมูลเรียลไทม์ผ่านฐานข้อมูลกลางระบบ
   - ระบบ **สำรองข้อมูล (Export Backup JSON)** และ **กู้คืนข้อมูล (Restore Import)**
   - ระบบ **ล้างข้อมูล (Reset Database)** เฉพาะหอพักหรือทั้งหมด (ต้องยืนยันสิทธิ์ผู้ดูแลระบบ)
3. **ระบบจัดการสิทธิ์ผู้ใช้งาน (Multi-Role User Authorization)**
   - รองรับสิทธิ์ 4 ระดับ: ผู้ดูแลระบบ, เจ้าหน้าที่สำนักงาน, ครูประจำหอพัก และผู้เยี่ยมชม
   - เข้ารหัสรหัสผ่านด้วยอัลกอริทึมมาตรฐาน และตรวจสอบสิทธิ์ก่อนเข้าถึงข้อมูลสำคัญ

---

## 🛠️ ขั้นตอนการรันระบบบนเครื่องคอมพิวเตอร์ของคุณ (Local Development)

### 1. เครื่องมือที่ต้องเตรียมก่อนเริ่มต้น (Prerequisites)
- **Node.js** (เวอร์ชัน 18.x หรือ 20.x ขึ้นไป)
- **npm** (มาพร้อมกับ Node.js)
- **Git** (สำหรับจัดการซอร์สโค้ด)

### 2. ดาวน์โหลดซอร์สโค้ดและติดตั้ง Dependencies

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd YOUR_REPOSITORY
npm install
```

### 3. เรียกทำงานระบบในโหมดพัฒนา (Start Development Server)

```bash
npm run dev
```

เปิดเบราว์เซอร์และเข้าไปที่ `http://localhost:3000`

---

## 🌐 การตั้งค่าเปิดใช้งาน GitHub Pages

1. **`base: './'` ใน `vite.config.ts`**: กำหนดให้ Build ไฟล์ Assets ด้วย Relative Path ทำให้โหลดไฟล์ JS/CSS ได้ถูกต้องบนทุก Subpath ของ GitHub Pages
2. **`public/404.html`**: รองรับ Single Page Application (SPA) Routing ป้องกันปัญหา 404 เมื่อ Refresh หน้าเว็บ
3. ใน GitHub Repository ไปที่ **Settings** -> **Pages** -> เลือก Source เป็น **`GitHub Actions`**
4. **ตั้งค่า Firebase Authorized Domains (สำคัญสำหรับการใช้งานฐานข้อมูล Firestore บน GitHub Pages)**:
   - เปิด [Firebase Console](https://console.firebase.google.com/) แล้วเลือกโปรเจกต์ `gen-lang-client-0460310471`
   - ไปที่เมนู **Authentication** -> **Settings** -> **Authorized domains** -> **Add domain**
   - เพิ่มโดเมน GitHub Pages ของคุณ (เช่น `<username>.github.io`)
5. **การเชื่อมต่อฐานข้อมูล Firestore ครั้งแรกบน GitHub Pages**:
   - กฎความปลอดภัยของ Firestore (`firestore.rules`) กำหนดให้ต้องยืนยันตัวตนด้วย **Google Sign-In** (เช่น บัญชีผู้ดูแลหลัก `domitory@pcccr.ac.th` หรือบัญชี Google ที่ยืนยันอีเมลแล้ว)
   - เมื่อเปิดเว็บผ่านลิงก์ `github.io` ให้คลิกปุ่ม **"เชื่อมต่อฐานข้อมูล Firestore (Google)"** หรือเข้าสู่ระบบด้วยปุ่ม **"ยืนยันตัวตนด้วย Google"** เพื่อให้ระบบโหลดและซิงค์ข้อมูลจาก Firestore ได้ทันที

---

## 📦 การสร้างไฟล์สำหรับ Production (Build Project)

```bash
npm run build
```
ไฟล์สำหรับ Deployment จะถูกสร้างขึ้นในโฟลเดอร์ `dist/`
