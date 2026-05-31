const res = await fetch("https://student-info-41f18-default-rtdb.asia-southeast1.firebasedatabase.app/school/results/one.json");
const data = await res.json();
for (const [k, v] of Object.entries(data.results)) {
  console.log(k, JSON.stringify((v as any)?.info || (v as any)?.name || "(no name field)"));
}
