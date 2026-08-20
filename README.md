# ระบบเช็คยอดและนับจำนวนนักเรียนหอพัก (Student Counting System)

ระบบบริหารจัดการและเช็คยอดนักเรียนหอพักประจำ พัฒนาด้วย **React 18 + TypeScript + Vite + Tailwind CSS** และเชื่อมต่อฐานข้อมูลเรียลไทม์ผ่าน **Google Firebase Firestore**

---

## 🌟 คุณสมบัติหลักของระบบ (Key Features)

1. **การเช็คยอดประจำวัน (Daily Student Attendance)**
   - เช็คยอดนักเรียนจำแนกตามหอพัก (หอพัก 1 - 6)
   - สรุปจำนวนนักเรียน: อยู่หอพัก, ลากลับบ้าน, ป่วย, ทำกิจกรรม, ขาด/ติดต่อไม่ได้
2. **ระบบจัดการฐานข้อมูลหลักบน Firebase (Firestore Database)**
   - บันทึก อ่าน แก้ไข ข้อมูลเรียลไทม์ลง Firebase Firestore
   - ระบบ **สำรองข้อมูล (Export Backup JSON)** และ **กู้คืนข้อมูล (Restore Import)**
   - ระบบ **ล้างข้อมูล (Reset Database)** เฉพาะหอพักหรือทั้งหมด
   - ปุ่ม **"สร้าง & ติดตั้งโครงสร้างข้อมูลเริ่มต้นบน Firebase"** สำหรับเริ่มต้นใช้งานใน Project ID ใหม่
3. **ระบบจัดการสิทธิ์ผู้ใช้งาน (Multi-Role User Authorization)**
   - รองรับสิทธิ์ 3 ระดับ: ผู้ดูแลระบบ/ผู้บริหาร, เจ้าหน้าที่สำนักงาน, ครูประจำหอพัก

---

## 🛠️ ขั้นตอนการรันระบบบนเครื่องคอมพิวเตอร์ของคุณ (Local Development)

### 1. เครื่องมือที่ต้องเตรียมก่อนเริ่มต้น (Prerequisites)
- **Node.js** (เวอร์ชัน 18.x หรือ 20.x ขึ้นไป)
- **npm** (มาพร้อมกับ Node.js)
- **Git** (สำหรับจัดการซอร์สโค้ด)

---

### 2. ดาวน์โหลดซอร์สโค้ด (Clone Repository)

```bash
# Clone โปรเจกต์ลงเครื่อง
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git

# เข้าสู่โฟลเดอร์โปรเจกต์
cd YOUR_REPOSITORY
```

---

### 3. ติดตั้ง Dependencies

```bash
npm install
```

---

### 4. เรียกทำงานระบบในโหมดพัฒนา (Start Development Server)

```bash
npm run dev
```

เปิดเบราว์เซอร์และเข้าไปที่:
👉 `http://localhost:3000` (หรือ URL ที่แสดงใน Terminal)

---

## 🚀 ขั้นตอนการนำระบบขึ้น GitHub (Publish to GitHub)

### วิธีที่ 1: นำขึ้น GitHub ผ่าน Terminal (Git Command Line)

1. เข้าไปที่ [GitHub Create Repository](https://github.com/new)
2. ตั้งชื่อ Repository เช่น `student-counting-system` และกด **Create repository**
3. รันชุดคำสั่งต่อไปนี้ใน Terminal บนเครื่องของคุณ:

```bash
# เริ่มต้น Git
git init

# เพิ่มไฟล์ทั้งหมดเข้าสู่ Staging
git add .

# บันทึก Commit แรก
git commit -m "Initial commit: Student Counting System with Firebase Firestore"

# ตั้งชื่อ Branch หลักเป็น main
git branch -M main

# เชื่อมต่อไปยัง Remote Repository บน GitHub
git remote add origin https://github.com/YOUR_USERNAME/student-counting-system.git

# Push โค้ดขึ้น GitHub
git push -u origin main
```

---

### วิธีที่ 2: นำขึ้น GitHub ด้วยฟังก์ชัน Export บน AI Studio
1. คลิกที่เมนู **Settings / Export** บริเวณแถบเครื่องมือของ AI Studio
2. เลือก **Export to GitHub**
3. อนุญาตสิทธิ์และเลือกบัญชี GitHub ของคุณ โครงสร้างโค้ดทั้งหมดจะถูกสร้างเป็น Repository ใหม่บน GitHub ทันที

---

## 🔥 การตั้งค่า Firebase Firestore ร่วมกับ GitHub Project ID ใหม่

เมื่อย้ายโปรเจกต์ไปยัง GitHub หรือเปลี่ยนไปใช้ Firebase Project ID ของคุณเอง:

1. นำไฟล์ `firebase-applet-config.json` ใส่ไว้ในโฟลเดอร์หลักของโปรเจกต์:
```json
{
  "projectId": "YOUR_PROJECT_ID",
  "appId": "YOUR_APP_ID",
  "firestoreDatabaseId": "(default)",
  "authDomain": "YOUR_PROJECT_ID.firebaseapp.com"
}
```
2. เปิดเบราว์เซอร์เข้าสู่ระบบ ไปที่หน้า **การจัดการผู้ใช้ & ฐานข้อมูล**
3. กดปุ่ม **"สร้าง & ติดตั้งโครงสร้างข้อมูลเริ่มต้นบน Firebase"** เพื่อสร้างโครงสร้างข้อมูลและบัญชีผู้ใช้งานตั้งต้นโดยอัตโนมัติ

---

## 🌐 การตั้งค่าเปิดใช้งาน GitHub Pages (แก้ไขปัญหาหน้าแรกขึ้นหน้าขาว / Blank Screen บน GitHub)

หากเปิดหน้าเว็บบน GitHub Pages (`https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/`) แล้วพบปัญหา **หน้าขาว (Blank Screen)** สาเหตุหลักเกิดจาก Path ของไฟล์ JavaScript/CSS ไม่ตรงกับ Subpath ของ Repository

### ✨ โซลูชันที่ระบบได้ปรับแต่งให้เรียบร้อยแล้ว:
1. **`base: './'` ใน `vite.config.ts`**: กำหนดให้ Vite Build ไฟล์ Assets ด้วย Relative Path ทำให้โหลดไฟล์ JS/CSS ได้ถูกต้องบนทุก Subpath ของ GitHub Pages
2. **`public/404.html`**: รองรับ Single Page Application (SPA) Routing ป้องกันปัญหา 404 เมื่อ Refresh หน้าเว็บ

### ⚙️ ขั้นตอนการเปิดใช้งาน GitHub Pages ใน GitHub Repository:
1. ไปที่ Repository ของคุณบน GitHub (`https://github.com/domitory-tech/Student-Counting-System`)
2. คลิกที่เมนู **Settings** -> **Pages**
3. ในส่วน **Build and deployment**:
   - **Source**: เปลี่ยนจาก Deploy from a branch เป็น **`GitHub Actions`**
4. ทุกครั้งที่มีการ `git push` ขึ้น branch `main` เวิร์กโฟลว์ `.github/workflows/deploy.yml` จะทำการติดตั้ง Node 22, สั่ง `npm run build` และ Deploy หน้าเว็บไปที่ GitHub Pages ให้อัตโนมัติ!
5. รอประมาณ 1-2 นาที GitHub จะแสดงผลหน้าเว็บได้ทันทีที่:
   👉 `https://domitory-tech.github.io/Student-Counting-System/`

---

## 📦 การสร้างไฟล์สำหรับ Production (Build Project)

```bash
npm run build
```
ไฟล์สำหรับ Deployment จะถูกสร้างขึ้นในโฟลเดอร์ `dist/` พร้อมนำไป Deploy บน Cloud Run, Vercel, Netlify หรือ GitHub Pages
