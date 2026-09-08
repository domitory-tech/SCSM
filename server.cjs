var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  loadDbFromDisk: () => loadDbFromDisk,
  saveDbToDisk: () => saveDbToDisk
});
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json({ limit: "10mb" }));
var dormitories = [
  {
    id: "dorm-1",
    name: "\u0E2B\u0E2D\u0E1E\u0E31\u0E01 1 (\u0E0A\u0E32\u0E22)",
    type: "male",
    teacherName: "\u0E04\u0E23\u0E39\u0E2A\u0E21\u0E0A\u0E32\u0E22 \u0E43\u0E08\u0E14\u0E35 (\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E2B\u0E2D\u0E1E\u0E31\u0E01)",
    teacherPhone: "081-111-2222",
    capacity: 80,
    teachers: [
      { id: "t-101", name: "\u0E04\u0E23\u0E39\u0E2A\u0E21\u0E0A\u0E32\u0E22 \u0E43\u0E08\u0E14\u0E35", phone: "081-111-2222", isHead: true },
      { id: "t-102", name: "\u0E04\u0E23\u0E39\u0E27\u0E34\u0E0A\u0E31\u0E22 \u0E23\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19", phone: "081-111-2223", isHead: false },
      { id: "t-103", name: "\u0E04\u0E23\u0E39\u0E18\u0E32\u0E19\u0E34\u0E19\u0E17\u0E23\u0E4C \u0E21\u0E31\u0E48\u0E19\u0E04\u0E07", phone: "081-111-2224", isHead: false },
      { id: "t-104", name: "\u0E04\u0E23\u0E39\u0E21\u0E32\u0E19\u0E1E \u0E2A\u0E38\u0E02\u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E34\u0E4C", phone: "081-111-2225", isHead: false }
    ]
  },
  {
    id: "dorm-2",
    name: "\u0E2B\u0E2D\u0E1E\u0E31\u0E01 2 (\u0E0A\u0E32\u0E22)",
    type: "male",
    teacherName: "\u0E04\u0E23\u0E39\u0E2A\u0E21\u0E04\u0E34\u0E14 \u0E14\u0E35\u0E40\u0E25\u0E34\u0E28 (\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E2B\u0E2D\u0E1E\u0E31\u0E01)",
    teacherPhone: "081-222-3331",
    capacity: 80,
    teachers: [
      { id: "t-201", name: "\u0E04\u0E23\u0E39\u0E2A\u0E21\u0E04\u0E34\u0E14 \u0E14\u0E35\u0E40\u0E25\u0E34\u0E28", phone: "081-222-3331", isHead: true },
      { id: "t-202", name: "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E40\u0E2A\u0E23\u0E34\u0E10 \u0E0A\u0E39\u0E40\u0E01\u0E35\u0E22\u0E23\u0E15\u0E34", phone: "081-222-3332", isHead: false },
      { id: "t-203", name: "\u0E04\u0E23\u0E39\u0E18\u0E35\u0E23\u0E30 \u0E28\u0E23\u0E35\u0E07\u0E32\u0E21", phone: "081-222-3333", isHead: false }
    ]
  },
  {
    id: "dorm-3",
    name: "\u0E2B\u0E2D\u0E1E\u0E31\u0E01 3 (\u0E0A\u0E32\u0E22)",
    type: "male",
    teacherName: "\u0E04\u0E23\u0E39\u0E40\u0E01\u0E23\u0E35\u0E22\u0E07\u0E44\u0E01\u0E23 \u0E21\u0E31\u0E48\u0E19\u0E04\u0E07 (\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E2B\u0E2D\u0E1E\u0E31\u0E01)",
    teacherPhone: "081-333-4441",
    capacity: 80,
    teachers: [
      { id: "t-301", name: "\u0E04\u0E23\u0E39\u0E40\u0E01\u0E23\u0E35\u0E22\u0E07\u0E44\u0E01\u0E23 \u0E21\u0E31\u0E48\u0E19\u0E04\u0E07", phone: "081-333-4441", isHead: true },
      { id: "t-302", name: "\u0E04\u0E23\u0E39\u0E1E\u0E07\u0E29\u0E4C\u0E28\u0E31\u0E01\u0E14\u0E34\u0E4C \u0E40\u0E08\u0E23\u0E34\u0E0D\u0E14\u0E35", phone: "081-333-4442", isHead: false },
      { id: "t-303", name: "\u0E04\u0E23\u0E39\u0E2D\u0E14\u0E34\u0E28\u0E23 \u0E27\u0E07\u0E28\u0E4C\u0E29\u0E32", phone: "081-333-4443", isHead: false },
      { id: "t-304", name: "\u0E04\u0E23\u0E39\u0E2D\u0E19\u0E38\u0E23\u0E31\u0E01\u0E29\u0E4C \u0E23\u0E31\u0E15\u0E19\u0E40\u0E14\u0E0A", phone: "081-333-4444", isHead: false }
    ]
  },
  {
    id: "dorm-4",
    name: "\u0E2B\u0E2D\u0E1E\u0E31\u0E01 4 (\u0E2B\u0E0D\u0E34\u0E07)",
    type: "female",
    teacherName: "\u0E04\u0E23\u0E39\u0E27\u0E34\u0E44\u0E25\u0E27\u0E23\u0E23\u0E13 \u0E40\u0E21\u0E15\u0E15\u0E32 (\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E2B\u0E2D\u0E1E\u0E31\u0E01)",
    teacherPhone: "081-444-5551",
    capacity: 80,
    teachers: [
      { id: "t-401", name: "\u0E04\u0E23\u0E39\u0E27\u0E34\u0E44\u0E25\u0E27\u0E23\u0E23\u0E13 \u0E40\u0E21\u0E15\u0E15\u0E32", phone: "081-444-5551", isHead: true },
      { id: "t-402", name: "\u0E04\u0E23\u0E39\u0E23\u0E31\u0E15\u0E19\u0E32 \u0E41\u0E01\u0E49\u0E27\u0E21\u0E13\u0E35", phone: "081-444-5552", isHead: false },
      { id: "t-403", name: "\u0E04\u0E23\u0E39\u0E1E\u0E34\u0E21\u0E1E\u0E4C\u0E43\u0E08 \u0E2A\u0E27\u0E48\u0E32\u0E07\u0E08\u0E34\u0E15\u0E15\u0E4C", phone: "081-444-5553", isHead: false },
      { id: "t-404", name: "\u0E04\u0E23\u0E39\u0E2D\u0E32\u0E23\u0E35\u0E22\u0E32 \u0E40\u0E1E\u0E0A\u0E23\u0E41\u0E17\u0E49", phone: "081-444-5554", isHead: false }
    ]
  },
  {
    id: "dorm-5",
    name: "\u0E2B\u0E2D\u0E1E\u0E31\u0E01 5 (\u0E2B\u0E0D\u0E34\u0E07)",
    type: "female",
    teacherName: "\u0E04\u0E23\u0E39\u0E19\u0E20\u0E32 \u0E1E\u0E23\u0E2B\u0E21\u0E21\u0E34\u0E19\u0E17\u0E23\u0E4C (\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E2B\u0E2D\u0E1E\u0E31\u0E01)",
    teacherPhone: "081-555-6661",
    capacity: 80,
    teachers: [
      { id: "t-501", name: "\u0E04\u0E23\u0E39\u0E19\u0E20\u0E32 \u0E1E\u0E23\u0E2B\u0E21\u0E21\u0E34\u0E19\u0E17\u0E23\u0E4C", phone: "081-555-6661", isHead: true },
      { id: "t-502", name: "\u0E04\u0E23\u0E39\u0E2A\u0E38\u0E1E\u0E23\u0E23\u0E29\u0E32 \u0E14\u0E27\u0E07\u0E41\u0E01\u0E49\u0E27", phone: "081-555-6662", isHead: false },
      { id: "t-503", name: "\u0E04\u0E23\u0E39\u0E27\u0E23\u0E23\u0E13\u0E32 \u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C", phone: "081-555-6663", isHead: false }
    ]
  },
  {
    id: "dorm-6",
    name: "\u0E2B\u0E2D\u0E1E\u0E31\u0E01 6 (\u0E2B\u0E0D\u0E34\u0E07)",
    type: "female",
    teacherName: "\u0E04\u0E23\u0E39\u0E01\u0E32\u0E19\u0E14\u0E32 \u0E19\u0E1E\u0E23\u0E31\u0E15\u0E19\u0E4C (\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E2B\u0E2D\u0E1E\u0E31\u0E01)",
    teacherPhone: "081-666-7771",
    capacity: 80,
    teachers: [
      { id: "t-601", name: "\u0E04\u0E23\u0E39\u0E01\u0E32\u0E19\u0E14\u0E32 \u0E19\u0E1E\u0E23\u0E31\u0E15\u0E19\u0E4C", phone: "081-666-7771", isHead: true },
      { id: "t-602", name: "\u0E04\u0E23\u0E39\u0E0A\u0E19\u0E34\u0E14\u0E32 \u0E1B\u0E31\u0E0D\u0E0D\u0E32\u0E44\u0E27", phone: "081-666-7772", isHead: false },
      { id: "t-603", name: "\u0E04\u0E23\u0E39\u0E28\u0E34\u0E23\u0E34\u0E1E\u0E23 \u0E1A\u0E38\u0E0D\u0E2A\u0E48\u0E07", phone: "081-666-7773", isHead: false },
      { id: "t-604", name: "\u0E04\u0E23\u0E39\u0E19\u0E07\u0E25\u0E31\u0E01\u0E29\u0E13\u0E4C \u0E40\u0E01\u0E35\u0E22\u0E23\u0E15\u0E34\u0E44\u0E1E\u0E1A\u0E39\u0E25\u0E22\u0E4C", phone: "081-666-7774", isHead: false }
    ]
  }
];
var studentsStore = [];
var noticesStore = [];
var attendanceStore = {};
var usersStore = [
  {
    id: "user-5",
    name: "\u0E14\u0E23.\u0E1B\u0E23\u0E30\u0E40\u0E2A\u0E23\u0E34\u0E10 (\u0E23\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E2D\u0E33\u0E19\u0E27\u0E22\u0E01\u0E32\u0E23)",
    role: "DEPUTY_DIRECTOR",
    roleLevel: 1,
    roleCategory: "ADMIN",
    roleCategoryName: "\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25",
    roleLabel: "\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25\u0E23\u0E30\u0E1A\u0E1A / \u0E1C\u0E39\u0E49\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23 (\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E40\u0E02\u0E49\u0E32\u0E16\u0E36\u0E07\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14)",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    password: "123456"
  },
  {
    id: "user-2",
    name: "\u0E04\u0E23\u0E39\u0E2A\u0E21\u0E0A\u0E32\u0E22 (\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E07\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01)",
    role: "HEAD_TEACHER",
    roleLevel: 1,
    roleCategory: "ADMIN",
    roleCategoryName: "\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25",
    roleLabel: "\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E07\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01 (\u0E41\u0E08\u0E49\u0E07\u0E2D\u0E1A\u0E23\u0E21 & \u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E01\u0E32\u0E23\u0E40\u0E0A\u0E47\u0E04\u0E22\u0E2D\u0E14)",
    avatarUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80",
    password: "123456"
  },
  {
    id: "user-1",
    name: "\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48 \u0E2A\u0E21\u0E28\u0E23\u0E35 (\u0E2A\u0E33\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19)",
    role: "ADMIN_OFFICER",
    roleLevel: 2,
    roleCategory: "STAFF",
    roleCategoryName: "\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48",
    roleLabel: "\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E2A\u0E33\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19 (\u0E19\u0E33\u0E40\u0E02\u0E49\u0E32\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25 & \u0E08\u0E31\u0E14\u0E17\u0E33\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19)",
    avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    password: "123456"
  },
  // Teacher User Accounts for Dormitories (Level 3 - DORM_TEACHER)
  {
    id: "user-101",
    name: "\u0E04\u0E23\u0E39\u0E2A\u0E21\u0E0A\u0E32\u0E22 \u0E43\u0E08\u0E14\u0E35",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "\u0E04\u0E23\u0E39\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    roleLabel: "\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01 1 (\u0E0A\u0E32\u0E22)",
    phone: "081-111-2222",
    dormId: "dorm-1",
    dormPosition: "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    allowedDormIds: ["dorm-1"],
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    password: "123456"
  },
  {
    id: "user-102",
    name: "\u0E04\u0E23\u0E39\u0E27\u0E34\u0E0A\u0E31\u0E22 \u0E23\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "\u0E04\u0E23\u0E39\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    roleLabel: "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E2B\u0E2D\u0E1E\u0E31\u0E01 1 (\u0E0A\u0E32\u0E22)",
    phone: "081-111-2223",
    dormId: "dorm-1",
    dormPosition: "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    allowedDormIds: ["dorm-1"],
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    password: "123456"
  },
  {
    id: "user-201",
    name: "\u0E04\u0E23\u0E39\u0E2A\u0E21\u0E04\u0E34\u0E14 \u0E14\u0E35\u0E40\u0E25\u0E34\u0E28",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "\u0E04\u0E23\u0E39\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    roleLabel: "\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01 2 (\u0E0A\u0E32\u0E22)",
    phone: "081-222-3331",
    dormId: "dorm-2",
    dormPosition: "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    allowedDormIds: ["dorm-2"],
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
    password: "123456"
  },
  {
    id: "user-301",
    name: "\u0E04\u0E23\u0E39\u0E40\u0E01\u0E23\u0E35\u0E22\u0E07\u0E44\u0E01\u0E23 \u0E21\u0E31\u0E48\u0E19\u0E04\u0E07",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "\u0E04\u0E23\u0E39\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    roleLabel: "\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01 3 (\u0E0A\u0E32\u0E22)",
    phone: "081-333-4441",
    dormId: "dorm-3",
    dormPosition: "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    allowedDormIds: ["dorm-3"],
    avatarUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80",
    password: "123456"
  },
  {
    id: "user-401",
    name: "\u0E04\u0E23\u0E39\u0E27\u0E34\u0E44\u0E25\u0E27\u0E23\u0E23\u0E13 \u0E40\u0E21\u0E15\u0E15\u0E32",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "\u0E04\u0E23\u0E39\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    roleLabel: "\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01 4 (\u0E2B\u0E0D\u0E34\u0E07)",
    phone: "081-444-5551",
    dormId: "dorm-4",
    dormPosition: "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    allowedDormIds: ["dorm-4"],
    avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
    password: "123456"
  },
  {
    id: "user-501",
    name: "\u0E04\u0E23\u0E39\u0E19\u0E20\u0E32 \u0E1E\u0E23\u0E2B\u0E21\u0E21\u0E34\u0E19\u0E17\u0E23\u0E4C",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "\u0E04\u0E23\u0E39\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    roleLabel: "\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01 5 (\u0E2B\u0E0D\u0E34\u0E07)",
    phone: "081-555-6661",
    dormId: "dorm-5",
    dormPosition: "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    allowedDormIds: ["dorm-5"],
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
    password: "123456"
  },
  {
    id: "user-601",
    name: "\u0E04\u0E23\u0E39\u0E01\u0E32\u0E19\u0E14\u0E32 \u0E19\u0E1E\u0E23\u0E31\u0E15\u0E19\u0E4C",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "\u0E04\u0E23\u0E39\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    roleLabel: "\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01 6 (\u0E2B\u0E0D\u0E34\u0E07)",
    phone: "081-666-7771",
    dormId: "dorm-6",
    dormPosition: "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    allowedDormIds: ["dorm-6"],
    avatarUrl: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80",
    password: "123456"
  }
];
var systemSettings = {
  schoolNameTh: "\u0E42\u0E23\u0E07\u0E40\u0E23\u0E35\u0E22\u0E19\u0E1E\u0E34\u0E08\u0E34\u0E15\u0E23\u0E1B\u0E31\u0E0D\u0E0D\u0E32\u0E19\u0E38\u0E01\u0E39\u0E25",
  schoolNameEn: "Pichit Panyanukul School",
  schoolAcronymTh: "\u0E1E.\u0E08.\u0E1B.",
  schoolAcronymEn: "PCCC",
  schoolLogoUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23A05AFF"/><stop offset="100%" stop-color="%236B21A8"/></linearGradient><linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23FDE047"/><stop offset="100%" stop-color="%23CA8A04"/></linearGradient></defs><circle cx="50" cy="50" r="46" fill="url(%23g1)" stroke="url(%23gold)" stroke-width="3"/><path d="M50 18 L75 32 V56 C75 72 50 84 50 84 C50 84 25 72 25 56 V32 Z" fill="none" stroke="url(%23gold)" stroke-width="3"/><path d="M50 25 L68 36 V54 C68 66 50 76 50 76 C50 76 32 66 32 54 V36 Z" fill="url(%23gold)" opacity="0.25"/><polygon points="50,34 54,44 64,44 56,51 59,61 50,55 41,61 44,51 36,44 46,44" fill="url(%23gold)"/></svg>`,
  systemNameTh: "\u0E23\u0E30\u0E1A\u0E1A\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19",
  systemNameEn: "Student Dormitory Management System",
  systemIcon: "building",
  lastUpdatedDate: "8 \u0E2A\u0E34\u0E07\u0E2B\u0E32\u0E04\u0E21 \u0E1E.\u0E28. 2569"
};
var DB_FILE_PATH = import_path.default.join(process.cwd(), "database.json");
function saveDbToDisk() {
  try {
    const payload = {
      dormitories,
      students: studentsStore,
      studentsStore,
      notices: noticesStore,
      noticesStore,
      attendance: attendanceStore,
      attendanceStore,
      users: usersStore,
      usersStore,
      systemSettings,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    import_fs.default.writeFileSync(DB_FILE_PATH, JSON.stringify(payload, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save primary database to disk:", err);
  }
}
function loadDbFromDisk() {
  try {
    if (import_fs.default.existsSync(DB_FILE_PATH)) {
      const raw = import_fs.default.readFileSync(DB_FILE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.dormitories) && parsed.dormitories.length > 0) dormitories = parsed.dormitories;
      const st = parsed.students || parsed.studentsStore;
      if (Array.isArray(st)) studentsStore = st;
      const nt = parsed.notices || parsed.noticesStore;
      if (Array.isArray(nt)) noticesStore = nt;
      const att = parsed.attendance || parsed.attendanceStore;
      if (att && typeof att === "object") attendanceStore = att;
      const us = parsed.users || parsed.usersStore;
      if (Array.isArray(us) && us.length > 0) usersStore = us;
      if (parsed.systemSettings && typeof parsed.systemSettings === "object") systemSettings = parsed.systemSettings;
      console.log(`Successfully loaded primary database from ${DB_FILE_PATH}`);
    } else {
      saveDbToDisk();
      console.log(`Initialized new primary database file at ${DB_FILE_PATH}`);
    }
  } catch (err) {
    console.error("Failed to load database from disk:", err);
  }
}
loadDbFromDisk();
function getEnrichedDorms() {
  return dormitories.map((dorm) => {
    if (dorm.teachers && dorm.teachers.length > 0) {
      const headTeacher = dorm.teachers.find((t) => t.isHead || t.position === "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01") || dorm.teachers[0];
      const summaryName = headTeacher ? `${headTeacher.name}${dorm.teachers.length > 1 ? ` (\u0E41\u0E25\u0E30\u0E17\u0E35\u0E21\u0E04\u0E23\u0E39 ${dorm.teachers.length - 1} \u0E17\u0E48\u0E32\u0E19)` : ""}` : dorm.teacherName;
      const summaryPhone = headTeacher && headTeacher.phone ? headTeacher.phone : dorm.teacherPhone;
      return {
        ...dorm,
        teacherName: summaryName,
        teacherPhone: summaryPhone
      };
    }
    const assignedTeacherUsers = usersStore.filter((u) => {
      const isTeacher = u.roleLevel === 3 || u.roleCategory === "DORM_TEACHER" || u.role === "DORM_TEACHER";
      const matchesDorm = u.dormId === dorm.id || u.allowedDormIds && u.allowedDormIds.includes(dorm.id);
      return isTeacher && matchesDorm;
    });
    if (assignedTeacherUsers.length > 0) {
      const dynamicTeachers = assignedTeacherUsers.map((u, idx) => {
        let pos = u.dormPosition;
        if (!pos) {
          if (idx === 0) pos = "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01";
          else if (idx === 1) pos = "\u0E04\u0E23\u0E39\u0E23\u0E2D\u0E07\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01";
          else if (idx === 2) pos = "\u0E04\u0E23\u0E39\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E2B\u0E2D\u0E1E\u0E31\u0E01";
          else pos = "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E2B\u0E2D\u0E1E\u0E31\u0E01";
        }
        return {
          id: u.id,
          name: u.name,
          phone: u.phone || "",
          position: pos,
          isHead: pos === "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01" || idx === 0
        };
      });
      const headTeacher = assignedTeacherUsers.find((u) => u.dormPosition === "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01") || assignedTeacherUsers[0];
      const teacherNameSummary = `${headTeacher.name}${assignedTeacherUsers.length > 1 ? ` (\u0E41\u0E25\u0E30\u0E17\u0E35\u0E21\u0E04\u0E23\u0E39 ${assignedTeacherUsers.length - 1} \u0E17\u0E48\u0E32\u0E19)` : ""}`;
      const teacherPhoneSummary = headTeacher.phone || dorm.teacherPhone || "-";
      return {
        ...dorm,
        teacherName: teacherNameSummary,
        teacherPhone: teacherPhoneSummary,
        teachers: dynamicTeachers
      };
    }
    return dorm;
  });
}
app.get("/api/dorms", (req, res) => {
  res.json({ success: true, data: getEnrichedDorms() });
});
app.post("/api/dorms", (req, res) => {
  const { name, type, teacherName, teacherPhone, capacity, teachers } = req.body;
  const newDorm = {
    id: `dorm-${dormitories.length + 1}`,
    name,
    type: type || "male",
    teacherName: teacherName || "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    teacherPhone: teacherPhone || "",
    capacity: capacity || 80,
    teachers: Array.isArray(teachers) ? teachers : []
  };
  dormitories.push(newDorm);
  saveDbToDisk();
  res.json({ success: true, data: newDorm });
});
app.put("/api/dorms/:id", (req, res) => {
  const { id } = req.params;
  const index = dormitories.findIndex((d) => d.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: "Dormitory not found" });
  const { name, type, teacherName, teacherPhone, capacity, teachers, assignedTeacherId } = req.body;
  dormitories[index] = {
    ...dormitories[index],
    ...name && { name },
    ...type && { type },
    ...teacherName && { teacherName },
    ...teacherPhone !== void 0 && { teacherPhone },
    ...capacity && { capacity: Number(capacity) },
    ...teachers !== void 0 && { teachers: Array.isArray(teachers) ? teachers : [] },
    ...assignedTeacherId !== void 0 && { assignedTeacherId }
  };
  if (assignedTeacherId) {
    const assignedUser = usersStore.find((u) => u.id === assignedTeacherId);
    if (assignedUser) {
      dormitories[index].teacherName = assignedUser.name;
      assignedUser.dormId = id;
    }
  }
  saveDbToDisk();
  res.json({ success: true, data: dormitories[index], message: "\u0E41\u0E01\u0E49\u0E44\u0E02\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22" });
});
app.get("/api/students", (req, res) => {
  const { dormId, grade, room } = req.query;
  let result = [...studentsStore];
  if (dormId) {
    result = result.filter((s) => s.dormId === String(dormId));
  }
  if (grade) {
    result = result.filter((s) => s.grade === String(grade));
  }
  if (room) {
    result = result.filter((s) => s.room === Number(room));
  }
  result.sort((a, b) => {
    if (a.grade !== b.grade) return a.grade.localeCompare(b.grade, "th");
    if (a.room !== b.room) return a.room - b.room;
    return a.no - b.no;
  });
  res.json({ success: true, data: result, total: result.length });
});
app.put("/api/students/:id", (req, res) => {
  const { id } = req.params;
  const index = studentsStore.findIndex((s) => s.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: "Student not found" });
  studentsStore[index] = {
    ...studentsStore[index],
    ...req.body
  };
  saveDbToDisk();
  res.json({ success: true, data: studentsStore[index], message: "\u0E41\u0E01\u0E49\u0E44\u0E02\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22" });
});
app.get("/api/users", (req, res) => {
  res.json({ success: true, data: usersStore });
});
app.post("/api/users", (req, res) => {
  const { name, roleCategory, roleLevel, dormId, dormPosition, allowedDormIds, phone, avatarUrl, password } = req.body;
  let roleCategoryName = "\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25";
  let roleLabel = name;
  let role = "ADMIN_OFFICER";
  const numLevel = Number(roleLevel) || 2;
  if (numLevel === 1 || roleCategory === "ADMIN") {
    roleCategoryName = "\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25";
    roleLabel = "\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25\u0E23\u0E30\u0E1A\u0E1A";
    role = "SYSTEM_ADMIN";
  } else if (numLevel === 2 || roleCategory === "STAFF") {
    roleCategoryName = "\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48";
    roleLabel = "\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E2A\u0E33\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19";
    role = "ADMIN_OFFICER";
  } else {
    roleCategoryName = "\u0E04\u0E23\u0E39\u0E2B\u0E2D\u0E1E\u0E31\u0E01";
    roleLabel = dormPosition || "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E2B\u0E2D\u0E1E\u0E31\u0E01";
    role = "DORM_TEACHER";
  }
  const finalAllowedDormIds = Array.isArray(allowedDormIds) && allowedDormIds.length > 0 ? allowedDormIds : dormId ? [dormId] : [];
  const newUser = {
    id: `user-${Date.now()}`,
    name,
    role,
    roleLevel: numLevel,
    roleCategory: roleCategory || "STAFF",
    roleCategoryName,
    roleLabel,
    phone: phone || void 0,
    dormId: dormId || (finalAllowedDormIds[0] || void 0),
    dormPosition: dormPosition || void 0,
    allowedDormIds: finalAllowedDormIds,
    avatarUrl: avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    password: password || "123"
  };
  usersStore.push(newUser);
  saveDbToDisk();
  res.json({ success: true, data: newUser, message: "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22" });
});
app.put("/api/users/:id", (req, res) => {
  const { id } = req.params;
  const index = usersStore.findIndex((u) => u.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: "User not found" });
  const updatedData = { ...req.body };
  if (updatedData.dormId && (!updatedData.allowedDormIds || updatedData.allowedDormIds.length === 0)) {
    updatedData.allowedDormIds = [updatedData.dormId];
  }
  usersStore[index] = {
    ...usersStore[index],
    ...updatedData
  };
  saveDbToDisk();
  res.json({ success: true, data: usersStore[index], message: "\u0E2D\u0E31\u0E1B\u0E40\u0E14\u0E15\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22" });
});
app.delete("/api/users/:id", (req, res) => {
  usersStore = usersStore.filter((u) => u.id !== req.params.id);
  saveDbToDisk();
  res.json({ success: true, message: "\u0E25\u0E1A\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22" });
});
app.post("/api/users/:id/change-password", (req, res) => {
  const { id } = req.params;
  const { oldPassword, newPassword, isAdminOverride } = req.body;
  const user = usersStore.find((u) => u.id === id);
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  if (!isAdminOverride) {
    if (user.password && user.password !== oldPassword) {
      return res.status(400).json({ success: false, message: "\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E40\u0E14\u0E34\u0E21\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
    }
  }
  user.password = newPassword;
  saveDbToDisk();
  res.json({ success: true, message: "\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22" });
});
app.get("/api/system-settings", (req, res) => {
  res.json({ success: true, data: systemSettings });
});
app.put("/api/system-settings", (req, res) => {
  systemSettings = {
    ...systemSettings,
    ...req.body
  };
  saveDbToDisk();
  res.json({ success: true, data: systemSettings, message: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E01\u0E32\u0E23\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22" });
});
app.post("/api/database/save-primary", (req, res) => {
  saveDbToDisk();
  res.json({
    success: true,
    message: "\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E41\u0E25\u0E30\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E0A\u0E38\u0E14\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19\u0E40\u0E1B\u0E47\u0E19\u0E10\u0E32\u0E19\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2B\u0E25\u0E31\u0E01\u0E02\u0E2D\u0E07\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27"
  });
});
app.post("/api/database/reset", (req, res) => {
  studentsStore = [];
  attendanceStore = {};
  noticesStore = [];
  dormitories = [];
  usersStore = usersStore.filter((u) => u.roleLevel === 1).map((u) => ({
    ...u,
    dormId: void 0,
    allowedDormIds: []
  }));
  saveDbToDisk();
  res.json({ success: true, message: "\u0E25\u0E49\u0E32\u0E07\u0E10\u0E32\u0E19\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14 (\u0E23\u0E27\u0E21\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E41\u0E25\u0E30\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E04\u0E23\u0E39\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25\u0E2B\u0E2D\u0E1E\u0E31\u0E01) \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27" });
});
app.post("/api/database/clear-attendance", (req, res) => {
  const { mode, date, month, startDate, endDate, dormId, clearNotices } = req.body;
  let countCleared = 0;
  let countNoticesCleared = 0;
  const isMatchingDate = (itemDate) => {
    if (!itemDate) return false;
    if (mode === "ALL") return true;
    if (mode === "BY_DATE" && date) return itemDate === date;
    if (mode === "BY_MONTH" && month) return itemDate.startsWith(month);
    if (mode === "BY_RANGE" && startDate && endDate) {
      return itemDate >= startDate && itemDate <= endDate;
    }
    return false;
  };
  const targetDorm = dormitories.find((d) => d.id === dormId);
  const dormNameLabel = dormId === "ALL" || !dormId ? "\u0E17\u0E38\u0E01\u0E2B\u0E2D\u0E1E\u0E31\u0E01" : targetDorm ? targetDorm.name : dormId;
  Object.keys(attendanceStore).forEach((key) => {
    const record = attendanceStore[key];
    const recordDate = record?.date || key.split("_")[0];
    const recordDorm = record?.dormId || key.split("_")[1];
    const matchDate = isMatchingDate(recordDate);
    const matchDorm = dormId === "ALL" || !dormId || recordDorm === dormId;
    if (matchDate && matchDorm) {
      delete attendanceStore[key];
      countCleared++;
    }
  });
  if (clearNotices) {
    const beforeNotices = noticesStore.length;
    noticesStore = noticesStore.filter((n) => !isMatchingDate(n.date));
    countNoticesCleared = beforeNotices - noticesStore.length;
  }
  saveDbToDisk();
  return res.json({
    success: true,
    message: `\u0E25\u0E49\u0E32\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E01\u0E32\u0E23\u0E40\u0E0A\u0E47\u0E04\u0E22\u0E2D\u0E14 (${countCleared} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23) \u0E41\u0E25\u0E30\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E41\u0E08\u0E49\u0E07\u0E2D\u0E1A\u0E23\u0E21 (${countNoticesCleared} \u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07) \u0E02\u0E2D\u0E07 ${dormNameLabel} \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27`,
    countCleared,
    countNoticesCleared
  });
});
app.post("/api/database/attendance/export", (req, res) => {
  const { mode, date, month, startDate, endDate, dormId, includeNotices = true } = req.body;
  const isMatchingDate = (itemDate) => {
    if (!itemDate) return false;
    if (mode === "ALL") return true;
    if (mode === "DATE" && date) return itemDate === date;
    if (mode === "MONTH" && month) return itemDate.startsWith(month);
    if (mode === "RANGE" && startDate && endDate) {
      return itemDate >= startDate && itemDate <= endDate;
    }
    return false;
  };
  const filteredAttendance = Object.values(attendanceStore).filter((r) => {
    const matchDate = isMatchingDate(r.date);
    const matchDorm = !dormId || dormId === "ALL" || r.dormId === dormId;
    return matchDate && matchDorm;
  });
  const filteredNotices = includeNotices ? noticesStore.filter((n) => isMatchingDate(n.date)) : [];
  res.json({
    success: true,
    data: {
      backupType: "ATTENDANCE_AND_NOTICES",
      mode,
      selectedDate: date || null,
      selectedMonth: month || null,
      startDate: startDate || null,
      endDate: endDate || null,
      dormId: dormId || "ALL",
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      attendance: filteredAttendance,
      notices: filteredNotices
    }
  });
});
app.post("/api/database/attendance/restore", (req, res) => {
  const { data, mode = "ALL", date, month, startDate, endDate, dormId } = req.body;
  const rawAttendance = Array.isArray(data?.attendance) ? data.attendance : [];
  const rawNotices = Array.isArray(data?.notices) ? data.notices : [];
  const isMatchingDate = (itemDate) => {
    if (!itemDate) return false;
    if (mode === "ALL") return true;
    if (mode === "DATE" && date) return itemDate === date;
    if (mode === "MONTH" && month) return itemDate.startsWith(month);
    if (mode === "RANGE" && startDate && endDate) {
      return itemDate >= startDate && itemDate <= endDate;
    }
    return false;
  };
  let restoredAtt = 0;
  rawAttendance.forEach((att) => {
    if (isMatchingDate(att.date) && (!dormId || dormId === "ALL" || att.dormId === dormId)) {
      attendanceStore[`${att.date}_${att.dormId}`] = att;
      restoredAtt++;
    }
  });
  let restoredNotices = 0;
  rawNotices.forEach((n) => {
    if (isMatchingDate(n.date)) {
      const idx = noticesStore.findIndex((item) => item.id === n.id);
      if (idx >= 0) noticesStore[idx] = n;
      else noticesStore.push(n);
      restoredNotices++;
    }
  });
  saveDbToDisk();
  res.json({
    success: true,
    message: `\u0E01\u0E39\u0E49\u0E04\u0E37\u0E19\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08: \u0E40\u0E0A\u0E47\u0E04\u0E22\u0E2D\u0E14 ${restoredAtt} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23, \u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E41\u0E08\u0E49\u0E07\u0E2D\u0E1A\u0E23\u0E21 ${restoredNotices} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23`
  });
});
app.post("/api/database/clear-students", (req, res) => {
  const { mode, dormId } = req.body;
  const countBefore = studentsStore.length;
  if (mode === "BY_DORM") {
    if (!dormId) {
      return res.status(400).json({ success: false, message: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E25\u0E1A\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19" });
    }
    const targetDorm = dormitories.find((d) => d.id === dormId);
    studentsStore = studentsStore.filter((s) => s.dormId !== dormId);
    saveDbToDisk();
    const deletedCount = countBefore - studentsStore.length;
    return res.json({
      success: true,
      message: `\u0E25\u0E1A\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E43\u0E19 ${targetDorm?.name || dormId} \u0E08\u0E33\u0E19\u0E27\u0E19 ${deletedCount} \u0E04\u0E19\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27`
    });
  } else if (mode === "ALL") {
    const deletedCount = studentsStore.length;
    studentsStore = [];
    saveDbToDisk();
    return res.json({
      success: true,
      message: `\u0E25\u0E1A\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E17\u0E38\u0E01\u0E2B\u0E2D\u0E1E\u0E31\u0E01 \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14\u0E08\u0E33\u0E19\u0E27\u0E19 ${deletedCount} \u0E04\u0E19\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27`
    });
  }
  res.status(400).json({ success: false, message: "\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E25\u0E1A\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
});
app.get("/api/database/export", (req, res) => {
  res.json({
    success: true,
    data: {
      dormitories,
      students: studentsStore,
      notices: noticesStore,
      attendance: attendanceStore,
      users: usersStore,
      systemSettings,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
});
app.post("/api/database/restore", (req, res) => {
  const { dormitories: d, students: s, notices: n, attendance: a, users: u, systemSettings: set } = req.body;
  if (Array.isArray(d)) dormitories = d;
  if (Array.isArray(s)) studentsStore = s;
  if (Array.isArray(n)) noticesStore = n;
  if (a && typeof a === "object") attendanceStore = a;
  if (Array.isArray(u)) usersStore = u;
  if (set && typeof set === "object") systemSettings = set;
  saveDbToDisk();
  res.json({ success: true, message: "\u0E01\u0E39\u0E49\u0E04\u0E37\u0E19\u0E10\u0E32\u0E19\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E08\u0E32\u0E01\u0E44\u0E1F\u0E25\u0E4C JSON \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27" });
});
app.post("/api/students/import", (req, res) => {
  const { dormId, students } = req.body;
  if (!dormId || !Array.isArray(students)) {
    return res.status(400).json({ success: false, message: "Invalid payload" });
  }
  const dorm = dormitories.find((d) => d.id === dormId);
  const newStudentsList = students.map((s, idx) => ({
    id: `std-${Date.now()}-${idx}`,
    studentId: String(s.studentId || `${66e3 + idx}`),
    no: Number(s.no) || idx + 1,
    title: s.title || (dorm?.type === "male" ? "\u0E19\u0E32\u0E22" : "\u0E19\u0E32\u0E07\u0E2A\u0E32\u0E27"),
    firstName: s.firstName,
    lastName: s.lastName,
    grade: s.grade || "\u0E21.1",
    room: Number(s.room) || 1,
    dormId,
    dormRoom: s.dormRoom || "101",
    gender: dorm?.type === "female" ? "female" : "male"
  }));
  studentsStore = studentsStore.filter((s) => s.dormId !== dormId).concat(newStudentsList);
  saveDbToDisk();
  res.json({
    success: true,
    message: `\u0E19\u0E33\u0E40\u0E02\u0E49\u0E32\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E08\u0E33\u0E19\u0E27\u0E19 ${newStudentsList.length} \u0E04\u0E19`,
    count: newStudentsList.length
  });
});
app.post("/api/students", (req, res) => {
  const newStudent = {
    id: `std-${Date.now()}`,
    studentId: req.body.studentId,
    no: Number(req.body.no) || 1,
    title: req.body.title || "\u0E19\u0E32\u0E22",
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    grade: req.body.grade || "\u0E21.1",
    room: Number(req.body.room) || 1,
    dormId: req.body.dormId,
    dormRoom: req.body.dormRoom || "101",
    gender: req.body.gender || "male"
  };
  studentsStore.push(newStudent);
  saveDbToDisk();
  res.json({ success: true, data: newStudent });
});
app.delete("/api/students/:id", (req, res) => {
  studentsStore = studentsStore.filter((s) => s.id !== req.params.id);
  saveDbToDisk();
  res.json({ success: true, message: "\u0E25\u0E1A\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08" });
});
app.post("/api/students/batch-delete", (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E25\u0E1A" });
  }
  const idSet = new Set(ids);
  const countBefore = studentsStore.length;
  studentsStore = studentsStore.filter((s) => !idSet.has(s.id));
  saveDbToDisk();
  const deletedCount = countBefore - studentsStore.length;
  res.json({ success: true, message: `\u0E25\u0E1A\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E08\u0E33\u0E19\u0E27\u0E19 ${deletedCount} \u0E04\u0E19\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27` });
});
app.get("/api/notices", (req, res) => {
  const { date } = req.query;
  let list = [...noticesStore];
  if (date) {
    list = list.filter((n) => n.date === String(date));
  }
  res.json({ success: true, data: list });
});
app.post("/api/notices", (req, res) => {
  const { date, title, topics, createdBy } = req.body;
  const newNotice = {
    id: `not-${Date.now()}`,
    date: date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
    title,
    topics: Array.isArray(topics) ? topics : [topics],
    createdBy: createdBy || "\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E07\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  noticesStore.unshift(newNotice);
  saveDbToDisk();
  res.json({ success: true, data: newNotice });
});
app.get("/api/attendance", (req, res) => {
  const { date, dormId } = req.query;
  const reqDate = date ? String(date) : (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  if (dormId) {
    const key = `${reqDate}_${dormId}`;
    const record = attendanceStore[key] || {
      id: key,
      date: reqDate,
      dormId: String(dormId),
      isHomeBreak: false,
      status: "PENDING",
      teacherOrientationNotes: [],
      records: []
    };
    return res.json({ success: true, data: record });
  }
  const result = {};
  dormitories.forEach((d) => {
    const key = `${reqDate}_${d.id}`;
    result[d.id] = attendanceStore[key] || {
      id: key,
      date: reqDate,
      dormId: d.id,
      isHomeBreak: false,
      status: "PENDING",
      teacherOrientationNotes: [],
      records: []
    };
  });
  res.json({ success: true, data: result, date: reqDate });
});
app.post("/api/attendance", (req, res) => {
  const { date, dormId, isHomeBreak, teacherOrientationNotes, records, checkedBy } = req.body;
  const key = `${date}_${dormId}`;
  const updatedRecord = {
    id: key,
    date,
    dormId,
    isHomeBreak: Boolean(isHomeBreak),
    status: isHomeBreak ? "HOME_BREAK" : "CHECKED",
    checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
    checkedBy: checkedBy || "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    teacherOrientationNotes: Array.isArray(teacherOrientationNotes) ? teacherOrientationNotes : [],
    records: records || []
  };
  attendanceStore[key] = updatedRecord;
  saveDbToDisk();
  res.json({ success: true, data: updatedRecord, message: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E01\u0E32\u0E23\u0E40\u0E0A\u0E47\u0E04\u0E22\u0E2D\u0E14\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08" });
});
app.get("/api/reports/daily", (req, res) => {
  const reportDate = req.query.date ? String(req.query.date) : (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const reportD = new Date(reportDate);
  reportD.setDate(reportD.getDate() - 1);
  const summaryDate = reportD.toISOString().split("T")[0];
  const gradesList = ["\u0E21.1", "\u0E21.2", "\u0E21.3", "\u0E21.4", "\u0E21.5", "\u0E21.6"];
  const totalMatrix = {};
  const outMatrix = {};
  const remainingMatrix = {};
  const dormTotals = {};
  const gradeTotals = {};
  gradesList.forEach((g) => {
    gradeTotals[g] = { total: 0, out: 0, remaining: 0 };
  });
  const absentStudentsList = [];
  let overallTotal = 0;
  let overallOut = 0;
  let overallRemaining = 0;
  let absentCounter = 0;
  dormitories.forEach((dorm) => {
    totalMatrix[dorm.id] = {};
    outMatrix[dorm.id] = {};
    remainingMatrix[dorm.id] = {};
    let dormTotalCount = 0;
    let dormOutCount = 0;
    let dormRemCount = 0;
    const dormStudents = studentsStore.filter((s) => s.dormId === dorm.id);
    const attendanceKey = `${summaryDate}_${dorm.id}`;
    const attendance = attendanceStore[attendanceKey];
    gradesList.forEach((g) => {
      const studentsInGrade = dormStudents.filter((s) => s.grade === g);
      const totalInGrade = studentsInGrade.length;
      let outInGrade = 0;
      if (attendance) {
        if (attendance.isHomeBreak) {
          outInGrade = totalInGrade;
        } else {
          studentsInGrade.forEach((std) => {
            const stdRec = attendance.records.find((r) => r.studentId === std.studentId);
            if (stdRec && stdRec.status !== "PRESENT") {
              outInGrade++;
              absentCounter++;
              let statusLabel = stdRec.status === "ROUND_HOME" ? "\u0E23\u0E2D\u0E1A\u0E01\u0E25\u0E31\u0E1A\u0E1A\u0E49\u0E32\u0E19" : "\u0E01\u0E25\u0E31\u0E1A\u0E1A\u0E49\u0E32\u0E19";
              if (stdRec.status === "SICK") statusLabel = "\u0E1B\u0E48\u0E27\u0E22";
              if (stdRec.status === "SKILL_COMP") statusLabel = "\u0E41\u0E02\u0E48\u0E07\u0E17\u0E31\u0E01\u0E29\u0E30";
              if (stdRec.status === "EXCHANGE") statusLabel = "\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E41\u0E25\u0E01\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19";
              if (stdRec.status === "OTHER") statusLabel = "\u0E2D\u0E37\u0E48\u0E19";
              absentStudentsList.push({
                no: absentCounter,
                studentId: std.studentId,
                fullName: `${std.title}${std.firstName} ${std.lastName}`,
                gradeRoom: `${std.grade}/${std.room}`,
                dormName: dorm.name,
                dormId: dorm.id,
                reason: stdRec.reason ? `${statusLabel} (${stdRec.reason})` : statusLabel,
                status: stdRec.status
              });
            }
          });
        }
      }
      const remInGrade = totalInGrade - outInGrade;
      totalMatrix[dorm.id][g] = totalInGrade;
      outMatrix[dorm.id][g] = outInGrade;
      remainingMatrix[dorm.id][g] = remInGrade;
      dormTotalCount += totalInGrade;
      dormOutCount += outInGrade;
      dormRemCount += remInGrade;
      gradeTotals[g].total += totalInGrade;
      gradeTotals[g].out += outInGrade;
      gradeTotals[g].remaining += remInGrade;
    });
    dormTotals[dorm.id] = {
      total: dormTotalCount,
      out: dormOutCount,
      remaining: dormRemCount
    };
    overallTotal += dormTotalCount;
    overallOut += dormOutCount;
    overallRemaining += dormRemCount;
  });
  const headTeacherNotices = noticesStore.filter((n) => n.date === summaryDate || n.date === reportDate);
  const dormTeacherOrientations = dormitories.map((dorm) => {
    const attendanceKey = `${summaryDate}_${dorm.id}`;
    const attendance = attendanceStore[attendanceKey];
    const dormEnriched = getEnrichedDorms().find((d) => d.id === dorm.id);
    const defaultTeacherName = dormEnriched?.teachers?.[0]?.name || dorm.teacherName || "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E2B\u0E2D\u0E1E\u0E31\u0E01";
    const ownNotes = (attendance?.teacherOrientationNotes || []).filter((n) => n.trim().length > 0);
    return {
      dormId: dorm.id,
      dormName: dorm.name,
      checkedBy: attendance?.checkedBy || defaultTeacherName,
      checkedAt: attendance?.checkedAt,
      status: attendance?.status || "PENDING",
      orientationNotes: ownNotes
    };
  });
  res.json({
    success: true,
    reportDate,
    summaryDate,
    dormitories,
    grades: gradesList,
    totalMatrix,
    outMatrix,
    remainingMatrix,
    dormTotals,
    gradeTotals,
    grandTotals: {
      total: overallTotal,
      out: overallOut,
      remaining: overallRemaining
    },
    absentStudentsList,
    signatories: {
      creator: "\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E07\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
      headTeacher: "\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E07\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
      deputyDirector: "\u0E23\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E2D\u0E33\u0E19\u0E27\u0E22\u0E01\u0E32\u0E23\u0E1D\u0E48\u0E32\u0E22\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23\u0E01\u0E34\u0E08\u0E01\u0E32\u0E23\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19"
    },
    headTeacherNotices,
    dormTeacherOrientations
  });
});
app.post("/api/google-sheets/export", async (req, res) => {
  try {
    const { accessToken, reportData } = req.body;
    if (!reportData) {
      return res.status(400).json({ success: false, message: "Missing reportData" });
    }
    const TARGET_DRIVE_FOLDER_ID = "17hrwt9Dy_liRz9sSte2PKOpO0QYqwcGg";
    const TARGET_DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/17hrwt9Dy_liRz9sSte2PKOpO0QYqwcGg?usp=sharing";
    if (accessToken) {
      const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          properties: {
            title: `\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19\u0E2A\u0E23\u0E38\u0E1B\u0E22\u0E2D\u0E14\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48_${reportData.reportDate}`
          },
          sheets: [
            { properties: { title: "1.\u0E2A\u0E23\u0E38\u0E1B\u0E22\u0E2D\u0E14\u0E08\u0E33\u0E19\u0E27\u0E19\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19" } },
            { properties: { title: "2.\u0E15\u0E32\u0E23\u0E32\u0E07\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E2D\u0E2D\u0E01\u0E2B\u0E2D\u0E1E\u0E31\u0E01" } },
            { properties: { title: "3.\u0E43\u0E1A\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E41\u0E08\u0E49\u0E07\u0E2D\u0E1A\u0E23\u0E21\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E27\u0E31\u0E19" } }
          ]
        })
      });
      if (createRes.ok) {
        const sheetJson = await createRes.json();
        const spreadsheetId = sheetJson.spreadsheetId;
        const spreadsheetUrl = sheetJson.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
        try {
          await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}?addParents=${TARGET_DRIVE_FOLDER_ID}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${accessToken}` }
          });
        } catch (fErr) {
          console.warn("Could not move file to folder:", fErr);
        }
        const sheet1Values = [
          ["\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19\u0E2A\u0E23\u0E38\u0E1B\u0E22\u0E2D\u0E14\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E43\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E27\u0E31\u0E19"],
          [`\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E08\u0E31\u0E14\u0E17\u0E33\u0E2A\u0E23\u0E38\u0E1B\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19: ${reportData.reportDate}`, `\u0E2A\u0E23\u0E38\u0E1B\u0E22\u0E2D\u0E14\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E04\u0E37\u0E19\u0E19\u0E35\u0E49: ${reportData.summaryDate}`],
          [],
          ["\u0E15\u0E32\u0E23\u0E32\u0E07\u0E08\u0E33\u0E19\u0E27\u0E19\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "", "", "", "", "", "", "\u0E15\u0E32\u0E23\u0E32\u0E07\u0E08\u0E33\u0E19\u0E27\u0E19\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E2D\u0E2D\u0E01\u0E2B\u0E2D\u0E1E\u0E31\u0E01"],
          ["\u0E2B\u0E2D\u0E1E\u0E31\u0E01 / \u0E23\u0E30\u0E14\u0E31\u0E1A\u0E0A\u0E31\u0E49\u0E19", ...reportData.grades, "\u0E23\u0E27\u0E21", "\u0E2B\u0E2D\u0E1E\u0E31\u0E01 / \u0E23\u0E30\u0E14\u0E31\u0E1A\u0E0A\u0E31\u0E49\u0E19", ...reportData.grades, "\u0E23\u0E27\u0E21"],
          ...reportData.dormitories.map((d) => [
            d.name,
            ...reportData.grades.map((g) => reportData.totalMatrix[d.id][g]),
            reportData.dormTotals[d.id].total,
            d.name,
            ...reportData.grades.map((g) => reportData.outMatrix[d.id][g]),
            reportData.dormTotals[d.id].out
          ]),
          [
            "\u0E23\u0E27\u0E21\u0E17\u0E31\u0E49\u0E07\u0E2A\u0E34\u0E49\u0E19",
            ...reportData.grades.map((g) => reportData.gradeTotals[g].total),
            reportData.grandTotals.total,
            "\u0E23\u0E27\u0E21\u0E17\u0E31\u0E49\u0E07\u0E2A\u0E34\u0E49\u0E19",
            ...reportData.grades.map((g) => reportData.gradeTotals[g].out),
            reportData.grandTotals.out
          ],
          [],
          ["\u0E15\u0E32\u0E23\u0E32\u0E07\u0E08\u0E33\u0E19\u0E27\u0E19\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E04\u0E07\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E41\u0E15\u0E48\u0E25\u0E30\u0E2B\u0E2D\u0E1E\u0E31\u0E01", "", "", "", "", "", "", ""],
          ["\u0E2B\u0E2D\u0E1E\u0E31\u0E01 / \u0E23\u0E30\u0E14\u0E31\u0E1A\u0E0A\u0E31\u0E49\u0E19", ...reportData.grades, "\u0E23\u0E27\u0E21", "\u0E25\u0E07\u0E0A\u0E37\u0E48\u0E2D.....................................................................", "(.....................................................)"],
          ...reportData.dormitories.map((d, idx) => {
            let sigLabel = "";
            if (idx === 0) sigLabel = "\u0E1C\u0E39\u0E49\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19 (\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E2A\u0E33\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19)";
            if (idx === 2) sigLabel = "\u0E25\u0E07\u0E0A\u0E37\u0E48\u0E2D.....................................................................";
            if (idx === 3) sigLabel = "(.....................................................)";
            if (idx === 4) sigLabel = "\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E07\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01";
            let sigValue = "";
            if (idx === 1) sigValue = "\u0E25\u0E07\u0E0A\u0E37\u0E48\u0E2D.....................................................................";
            if (idx === 2) sigValue = "(.....................................................)";
            if (idx === 3) sigValue = "\u0E23\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E2D\u0E33\u0E19\u0E27\u0E22\u0E01\u0E32\u0E23";
            return [
              d.name,
              ...reportData.grades.map((g) => reportData.remainingMatrix[d.id][g]),
              reportData.dormTotals[d.id].remaining,
              sigLabel,
              sigValue
            ];
          }),
          [
            "\u0E23\u0E27\u0E21\u0E17\u0E31\u0E49\u0E07\u0E2A\u0E34\u0E49\u0E19",
            ...reportData.grades.map((g) => reportData.gradeTotals[g].remaining),
            reportData.grandTotals.remaining
          ]
        ];
        const sheet2Values = [
          ["\u0E15\u0E32\u0E23\u0E32\u0E07\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E2D\u0E2D\u0E01\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E27\u0E31\u0E19"],
          [`\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E08\u0E31\u0E14\u0E17\u0E33\u0E2A\u0E23\u0E38\u0E1B\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19: ${reportData.reportDate}`, `\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E23\u0E38\u0E1B\u0E22\u0E2D\u0E14\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E04\u0E37\u0E19\u0E19\u0E35\u0E49: ${reportData.summaryDate}`],
          [],
          ["\u0E17\u0E35\u0E48", "\u0E23\u0E2B\u0E31\u0E2A\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19", "\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19", "\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E0A\u0E31\u0E49\u0E19/\u0E2B\u0E49\u0E2D\u0E07", "\u0E2B\u0E2D\u0E1E\u0E31\u0E01", "\u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25\u0E17\u0E35\u0E48\u0E2D\u0E2D\u0E01\u0E2B\u0E2D\u0E1E\u0E31\u0E01"],
          ...reportData.absentStudentsList.map((s) => [
            s.no,
            s.studentId,
            s.fullName,
            s.gradeRoom,
            s.dormName,
            s.reason
          ])
        ];
        const sheet3Values = [
          ["\u0E43\u0E1A\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E41\u0E08\u0E49\u0E07\u0E2D\u0E1A\u0E23\u0E21\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E27\u0E31\u0E19"],
          [`\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E08\u0E31\u0E14\u0E17\u0E33\u0E2A\u0E23\u0E38\u0E1B\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19: ${reportData.reportDate}`, `\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E23\u0E38\u0E1B\u0E22\u0E2D\u0E14\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E04\u0E37\u0E19\u0E19\u0E35\u0E49: ${reportData.summaryDate}`],
          [],
          ["1. \u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E41\u0E08\u0E49\u0E07\u0E2D\u0E1A\u0E23\u0E21\u0E08\u0E32\u0E01\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E07\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01"],
          ...reportData.headTeacherNotices && reportData.headTeacherNotices.length > 0 ? reportData.headTeacherNotices.flatMap((n) => [
            [`\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D: ${n.title}`],
            ...n.topics.map((t) => [`   - ${t}`])
          ]) : [["\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E41\u0E08\u0E49\u0E07\u0E2D\u0E1A\u0E23\u0E21\u0E08\u0E32\u0E01\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E07\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E43\u0E19\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49"]],
          [],
          ["2. \u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E17\u0E35\u0E48\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E2D\u0E1A\u0E23\u0E21\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19"],
          ...reportData.dormTeacherOrientations && reportData.dormTeacherOrientations.length > 0 ? reportData.dormTeacherOrientations.flatMap((o) => [
            [`${o.dormName} (\u0E04\u0E23\u0E39\u0E1C\u0E39\u0E49\u0E40\u0E0A\u0E47\u0E04\u0E22\u0E2D\u0E14\u0E41\u0E25\u0E30\u0E2D\u0E1A\u0E23\u0E21: ${o.checkedBy || "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E2B\u0E2D\u0E1E\u0E31\u0E01"})`],
            ...o.orientationNotes && o.orientationNotes.length > 0 ? o.orientationNotes.map((note) => [`   - ${note}`]) : [["   - \u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E2D\u0E1A\u0E23\u0E21\u0E43\u0E19\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49"]]
          ]) : [["\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E2D\u0E1A\u0E23\u0E21\u0E08\u0E32\u0E01\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E2B\u0E2D\u0E1E\u0E31\u0E01"]]
        ];
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            valueInputOption: "USER_ENTERED",
            data: [
              { range: "'1.\u0E2A\u0E23\u0E38\u0E1B\u0E22\u0E2D\u0E14\u0E08\u0E33\u0E19\u0E27\u0E19\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19'!A1", values: sheet1Values },
              { range: "'2.\u0E15\u0E32\u0E23\u0E32\u0E07\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E2D\u0E2D\u0E01\u0E2B\u0E2D\u0E1E\u0E31\u0E01'!A1", values: sheet2Values },
              { range: "'3.\u0E43\u0E1A\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E41\u0E08\u0E49\u0E07\u0E2D\u0E1A\u0E23\u0E21\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E27\u0E31\u0E19'!A1", values: sheet3Values }
            ]
          })
        });
        return res.json({
          success: true,
          spreadsheetId,
          spreadsheetUrl,
          driveFolderUrl: TARGET_DRIVE_FOLDER_URL,
          message: "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E41\u0E25\u0E30\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E44\u0E1F\u0E25\u0E4C\u0E25\u0E07\u0E42\u0E1F\u0E25\u0E40\u0E14\u0E2D\u0E23\u0E4C Google Drive \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27!"
        });
      }
    }
    return res.json({
      success: true,
      spreadsheetUrl: TARGET_DRIVE_FOLDER_URL,
      driveFolderUrl: TARGET_DRIVE_FOLDER_URL,
      message: "\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E40\u0E1B\u0E34\u0E14\u0E44\u0E1B\u0E22\u0E31\u0E07\u0E42\u0E1F\u0E25\u0E40\u0E14\u0E2D\u0E23\u0E4C Google Drive \u0E23\u0E32\u0E22\u0E07\u0E32\u0E19\u0E2A\u0E23\u0E38\u0E1B\u0E2B\u0E2D\u0E1E\u0E31\u0E01"
    });
  } catch (err) {
    console.error("Export Google Sheets Error:", err);
    res.status(500).json({ success: false, message: err.message || "Export failed" });
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  loadDbFromDisk,
  saveDbToDisk
});
//# sourceMappingURL=server.cjs.map
