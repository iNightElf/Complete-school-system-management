// Debug student keys in Class One
const res = await fetch("https://student-info-41f18-default-rtdb.asia-southeast1.firebasedatabase.app/school/results/one.json");
const data = await res.json();
if (data?.results) {
  for (const [k, v] of Object.entries(data.results)) {
    console.log("Key:", k, "Terms:", Object.keys((v as any)?.terms || {}).join(","));
  }
}
const res2 = await fetch("https://student-info-41f18-default-rtdb.asia-southeast1.firebasedatabase.app/school/students/one.json");
const sts = await res2.json();
const arr = Array.isArray(sts) ? sts : Object.values(sts);
for (const s of arr) {
  if (s && s.name) {
    const rollId = s.roll ? "r" + s.roll : "n" + s.name.replace(/\s+/g, "_");
    console.log("roll=" + String(s.roll) + " name=" + s.name + " id=" + rollId);
  }
}
