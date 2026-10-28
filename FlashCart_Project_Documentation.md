# FlashCart: High-Speed Flash Sale & Warehouse Inventory Command Center
> **Educational Project for Sardar Patel Institute of Technology (SPIT)**  
> **Academic Year:** 2026  
> **Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Cloud Serverless Functions.

---

## Table of Contents
1. [Executive Summary & System Overview](#1-executive-summary--system-overview)
2. [System Architecture & Technology Stack](#2-system-architecture--technology-stack)
3. [Frontend Architecture & Complete Page Specifications](#3-frontend-architecture--complete-page-specifications)
   - [3.1 Customer Storefront & Live Catalog Grid (`/`)](#31-customer-storefront--live-catalog-grid---apppagetsx)
   - [3.2 User-Isolated Shopping Cart & Pincode Prompt](#32-user-isolated-shopping-cart--shipping-pincode-prompt)
   - [3.3 Instant 1-Click Checkout & Printable Receipt](#33-instant-1-click-checkout--printable-order-receipt)
   - [3.4 Warehouse Command Center / Admin Dashboard (`/admin`)](#34-warehouse-command-center--admin-dashboard-admin---appadminpagetsx)
   - [3.5 Inventory Database Table with Inline Editors (`/admin/products`)](#35-inventory-database-table-with-inline-editors-adminproducts---appadminproductspagetsx)
   - [3.6 Register New Inventory Intake Form (`/admin/add-product`)](#36-register-new-inventory-intake-form-adminadd-product---appadminadd-productpagetsx)
   - [3.7 Admin Wizard & Staff Provisioning (`/admin/users`)](#37-admin-wizard--staff-provisioning-adminusers---appadminuserspagetsx)
   - [3.8 Admin Portal Login & Master Override (`/admin/login`)](#38-admin-portal-login--master-override-adminlogin---appadminloginpagetsx)
4. [Backend API Route Specifications](#4-backend-api-route-specifications)
5. [Key Algorithmic Implementations](#5-key-algorithmic-implementations)
   - [5.1 Strict Flash Sale Oversell Protection](#51-strict-flash-sale-oversell-protection)
   - [5.2 Real-time Date-based Expiry Classification](#52-real-time-date-based-expiry-classification)
   - [5.3 Role-Based Access Control (RBAC) & Security Guards](#53-role-based-access-control-rbac--security-guards)
6. [Production Deployment & Continuous Integration Protocol](#6-production-deployment--continuous-integration-protocol)
7. [Academic Project Declaration & Attribution](#7-academic-project-declaration--attribution)

---

## 1. Executive Summary & System Overview

**FlashCart** is an enterprise-grade, high-concurrency eCommerce web application engineered specifically to solve the classical computational and concurrency bottlenecks encountered during *flash sales* and high-demand product drops.

During high-traffic flash sale events, traditional eCommerce platforms frequently fail due to **race conditions, inventory overselling, and database deadlocks**. FlashCart incorporates strict atomic stock verification, isolated client-side cart states, and seamless warehouse operations into a unified, responsive platform.

### Core Objectives
- **Zero Oversell Guarantee:** Guarantee that customer order quantities never exceed physically available warehouse stock, regardless of concurrent checkout attempts.
- **End-to-End Inventory Lifecycle Tracking:** Track goods from warehouse intake to manufacturing date, real-time stock levels, and expiration monitoring.
- **Automated Perishable Alerts:** Categorize products into expired (`< Today`) and upcoming expiration (`<= 7 days`) buckets with high-visibility color-coded badges.
- **Role-Based Administrative Security:** Isolate warehouse management tools behind strict role-based access control (RBAC), multi-layered JWT session verification, and administrative provisioning wizards.
- **Seamless Direct Checkout:** Frictionless, 1-click checkout simulation coupled with delivery pincode capture and an automated, printable receipt/tax invoice generator.

---

## 2. System Architecture & Technology Stack

The system follows a modern decoupled Cloud Architecture with Next.js App Router providing both the presentation layer (Server & Client Components) and the serverless API micro-services.

| Layer / Tier | Technology / Tool | Version | Responsibility |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | Next.js (App Router) | 15.x | SSR, Static Generation, React Server Components & Client Hydration. |
| **UI Library** | React | 19.x | Declarative component state trees (`useState`, `useEffect`). |
| **Styling & Design** | Tailwind CSS | v4.0 | Utility-first styling, mobile-first responsiveness, modern color palettes. |
| **Authentication** | Supabase Auth (GoTrue) | v2 | JWT-based authentication, user metadata management, and encrypted session storage. |
| **Backend API** | Next.js Route Handlers | 15.x | Serverless micro-endpoints for atomic stock verification, checkout, and admin tools. |
| **Deployment & Hosting** | Vercel Edge Network | Production | Serverless runtime, global CDN distribution, automated CI/CD pipeline. |

---

## 3. Frontend Architecture & Complete Page Specifications

### 3.1 Customer Storefront & Live Catalog Grid (`/` • `app/page.tsx`)
- **Target User:** Retail shoppers and flash sale participants.
- **Page Title:** `FlashCart | Live Flash Sale Store`
- **Key Features:**
  - **Flash Sale Hero Banner:** High-energy visual header with flash sale branding and stock status.
  - **Instant Search & Category Chips:** Real-time filter by item name or quick category chips (`All`, `Electronics`, `Food`, etc.).
  - **Stock Badge System:** Real-time remaining stock tags (`50 units` green, `3 units` bold red).
  - **Oversell Prevention in UI:** Quantity controls prevent selecting higher counts than physical stock.

> 📷 **[INSERT SCREENSHOT: Customer Storefront - Flash Sale Hero & Catalog Grid]**  
> *Paste full screenshot showing active product cards, category chips, search bar, and live stock tags.*  
> **Figure 3.1:** FlashCart Customer Storefront with Live Flash Sale Catalog

---

### 3.2 User-Isolated Shopping Cart & Shipping Pincode Prompt
- **User-Isolated Cart:** Shopping cart persisted in `localStorage` keyed to user ID (or guest cart if unauthenticated).
- **Shipping Pincode Prompt Modal:** Captures and validates postal delivery code prior to order processing to ensure delivery coordinates are saved to the user profile.

> 📷 **[INSERT SCREENSHOT: Shopping Cart Drawer & Shipping Pincode Prompt Modal]**  
> *Paste screenshot showing the slide-over cart drawer and the shipping pincode modal dialog.*  
> **Figure 3.2:** Slide-Over Cart Drawer & Shipping Pincode Prompt Modal

---

### 3.3 Instant 1-Click Checkout & Printable Order Receipt
- **Direct Checkout:** Instant 1-click purchase without third-party payment gateway friction for flash sale simulation.
- **Printable Official Receipt Modal:** Formatted tax invoice modal with order ID, itemized totals, delivery coordinates, and a `window.print()` trigger with print-optimized CSS.

> 📷 **[INSERT SCREENSHOT: Official Printable Order Receipt / Tax Invoice]**  
> *Paste screenshot of confirmed receipt modal showing order breakdown, delivery pincode, and print trigger.*  
> **Figure 3.3:** Official Printable Order Receipt & Tax Invoice Modal

---

### 3.4 Warehouse Command Center / Admin Dashboard (`/admin` • `app/admin/page.tsx`)
- **Target User:** Warehouse supervisors, inventory managers, system administrators.
- **Page Title:** `Warehouse Command Center | FlashCart Admin`
- **Security:** Protected by server-side verification endpoint `/api/admin/verify`.
- **Key Features:**
  - **Interactive Metric Card 1 (Active Catalog):** Real-time count of total catalog items. Clicking navigates to full database.
  - **Interactive Metric Card 2 (Low Stock Alert):** Displays count of critical inventory items (<10 units). Clicking navigates to filtered table (`?filter=low`).
  - **Interactive Metric Card 3 (Expiry Alerts):** Displays count of expired and upcoming expiring goods. Clicking navigates to `?filter=expiring`.
  - **Quick Action Launcher:** Shortcut action tiles for *+ Add New Product* and *+ Add Admin Wizard*.
  - **User Profile Dropdown:** Initials avatar circle displaying email and secure sign-out trigger.

> 📷 **[INSERT SCREENSHOT: Warehouse Command Center Dashboard & Live Metric Cards]**  
> *Paste screenshot showing the Admin Dashboard with Active Catalog, Low Stock Alert, and Expiry Alert cards.*  
> **Figure 3.4:** Warehouse Command Center Dashboard & Real-Time Metric Cards

---

### 3.5 Inventory Database Table with Inline Editors (`/admin/products` • `app/admin/products/page.tsx`)
- **Target User:** Inventory controllers and dispatch operators.
- **Page Title:** Dynamic based on active filter (`Inventory Database`, `Low Stock Alerts`, `Expiry Alerts`).
- **Key Features:**
  - **Inline Stock Stepper & Edit:** Update stock quantities directly from table using `[-]` / `[+]` steppers or clicking the badge to enter an exact number, saving via `/api/admin/update-stock`.
  - **Inline Expiry Date Editor:** Change expiration date inline using native HTML5 date picker, saving via `/api/admin/update-expiry`.
  - **Visual Expiry Badges:**
    - `⚠️ EXPIRED` (Red badge for items past today)
    - `⏳ Expiring Soon` (Amber badge for items expiring within 7 days)
    - `Valid` (Green badge for healthy stock)
  - **Cascade Product Deletion:** Trash button with double confirmation modal invokes `/api/admin/products/delete`.

> 📷 **[INSERT SCREENSHOT: Inventory Database Table with Inline Stock & Expiry Date Editors]**  
> *Paste screenshot showing the inventory table with stock stepper buttons, inline date pickers, and color-coded expiry badges.*  
> **Figure 3.5:** Inventory Database Table with Inline Stock & Expiry Date Editors

---

### 3.6 Register New Inventory Intake Form (`/admin/add-product` • `app/admin/add-product/page.tsx`)
- **Target User:** Warehouse procurement staff.
- **Page Title:** `Register New Inventory | FlashCart Admin`
- **Key Features:**
  - Form capturing product name, category, unit price, stock quantity, and expiration date.
  - Performs transactional registration and sets manufacturing date automatically to current timestamp.

> 📷 **[INSERT SCREENSHOT: Register New Inventory Intake Form]**  
> *Paste screenshot showing the Add Product form with fields for product name, category, price, stock, and expiry date.*  
> **Figure 3.6:** Register New Inventory Intake Form

---

### 3.7 Admin Wizard & Staff Provisioning (`/admin/users` • `app/admin/users/page.tsx`)
- **Target User:** Super Administrators.
- **Page Title:** `Add Admin Wizard | FlashCart Admin`
- **Key Features:**
  - Form to onboard new staff accounts with email, password, and assigned role.
  - Calls `/api/admin/create-user` using Supabase Service Role Key with `email_confirm: true`.
  - Synchronizes administrative role across both authentication metadata and customer profiles.

> 📷 **[INSERT SCREENSHOT: Admin Wizard - Staff Provisioning Form]**  
> *Paste screenshot of the Add Admin Wizard user registration interface.*  
> **Figure 3.7:** Admin Wizard & Staff Provisioning Portal

---

### 3.8 Admin Portal Login & Master Override (`/admin/login` • `app/admin/login/page.tsx`)
- **Target User:** Administrative team members.
- **Page Title:** `Admin Portal Login | FlashCart`
- **Key Features:**
  - Secure credential authentication with automatic redirect protection.
  - Interactive master credentials hint banner: `admin@flashcart.com` / `Admin@1234`.
  - **Developer Override Wizard:** Allows bootstrapping access using secret `ADMIN_SETUP_KEY` (`flashcart-setup-2024`) via `/api/admin/first-setup`.

> 📷 **[INSERT SCREENSHOT: Admin Portal Login Screen & Master Credentials Hint]**  
> *Paste screenshot of the Admin Login screen showing the email/password form and master hint box.*  
> **Figure 3.8:** Admin Portal Login Screen & Master Credentials Hint Banner

---

## 4. Backend API Route Specifications

| Route Endpoint | HTTP Method | Auth Tier | Description & Business Logic |
| :--- | :--- | :--- | :--- |
| `/api/checkout` | POST | Customer Session | Validates inventory availability, updates shipping pincode, decrements warehouse stock atomically, generates order records, and produces receipt payload. |
| `/api/admin/verify` | GET | Bearer JWT | Validates Supabase token using Service Role, verifies `customers.role` and `user_metadata.role`, returns `{ isAdmin: true/false }`. |
| `/api/admin/update-stock` | POST | Admin Guard | Modifies physical `stock_quantity` in `inventory`. Automatically toggles status to `OUT_OF_STOCK` if quantity is zero. |
| `/api/admin/update-expiry` | POST | Admin Guard | Updates the `expiry_date` attribute of an inventory batch. |
| `/api/admin/products/delete` | POST | Admin Guard | Cascade deletion: cleans up inventory rows and order items before deleting parent product record. |
| `/api/admin/create-user` | POST | Admin Guard | Provisions new staff user via Supabase Auth Admin API with pre-confirmed email and admin privileges. |
| `/api/admin/first-setup` | POST | Setup Key | Emergency / initial setup override granting admin privileges using `ADMIN_SETUP_KEY`. |

---

## 5. Key Algorithmic Implementations

### 5.1 Strict Flash Sale Oversell Protection
1. **Client Guard:** Frontend input validation prohibits selecting quantities greater than active warehouse inventory.
2. **Atomic Server Guard:** The `/api/checkout` endpoint checks the latest database quantity before confirming any order:
   ```javascript
   if (requested > available) {
     return NextResponse.json({
       success: false,
       message: `Flash Sale Oversell Protection: Only ${available} units remaining!`
     }, { status: 409 });
   }
   ```
3. **Atomic Stock Decrement:** Stock is subtracted immediately on the database record:
   ```javascript
   const newStock = Math.max(0, currentStock - requested);
   await supabaseAdmin.from('inventory').update({ stock_quantity: newStock, status: newStock === 0 ? 'OUT_OF_STOCK' : 'IN_STOCK' }).eq('product_id', id);
   ```

### 5.2 Real-time Date-based Expiry Classification
Evaluated dynamically without running recurring background crons:
- **Expired:** `expiry_date < CURRENT_DATE`
- **Expiring Soon:** `expiry_date >= CURRENT_DATE && expiry_date <= CURRENT_DATE + 7 days`
- **Valid:** `expiry_date > CURRENT_DATE + 7 days`

---

## 6. Production Deployment & Continuous Integration Protocol

### Deployment Steps on Vercel
1. Commit all project files to Git:
   ```bash
   git add .
   git commit -m "FlashCart Production Release"
   ```
2. Push to GitHub:
   ```bash
   gh repo create ecommerce-app --public --source=. --remote=origin --push
   ```
3. Import project into Vercel and set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL`
   - `ADMIN_SETUP_KEY`
4. Click **Deploy**.

### Future Update & Maintenance Cycle
Whenever you update code locally, publish changes to your live site simply by running:
```bash
git add .
git commit -m "Description of changes"
git push origin main
```
Vercel's automated CI/CD pipeline detects the push on branch `main` and automatically rebuilds and deploys the live application in under 60 seconds with zero downtime.

---

## 7. Academic Project Declaration & Attribution

**Educational project for Sardar Patel Institute of Technology**  
*Academic Year 2026 • Mumbai, India*
