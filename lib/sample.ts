// Sample bakery used by "Örnek pastane verilerini yükle" and supabase/seed/demo_bakery.sql.
// Prices, weights and recipes are illustrative starting points for a demo.
type SampleProduct = {
  name: string; emoji: string; unit: string; price: number; stock: number; min_stock: number; weight_g: number;
  recipe: Record<string, number>; // ingredient name → amount per unit
};

export const SAMPLE_BAKERY: {
  ingredients: { name: string; unit: string; stock: number; min_stock: number }[];
  products: SampleProduct[];
} = {
  ingredients: [
    { name: "Un", unit: "kg", stock: 45, min_stock: 15 },
    { name: "Toz şeker", unit: "kg", stock: 18, min_stock: 8 },
    { name: "Pudra şekeri", unit: "kg", stock: 4, min_stock: 2 },
    { name: "Tereyağı", unit: "kg", stock: 9, min_stock: 4 },
    { name: "Margarin", unit: "kg", stock: 6, min_stock: 3 },
    { name: "Yumurta", unit: "adet", stock: 210, min_stock: 60 },
    { name: "Süt", unit: "L", stock: 14, min_stock: 10 },
    { name: "Krema", unit: "L", stock: 4.5, min_stock: 5 },
    { name: "Bitter çikolata", unit: "kg", stock: 2.6, min_stock: 3 },
    { name: "Kakao", unit: "kg", stock: 2, min_stock: 1 },
    { name: "Taze meyve", unit: "kg", stock: 3.5, min_stock: 2 },
    { name: "Beyaz peynir", unit: "kg", stock: 5, min_stock: 2 },
    { name: "Krem peynir", unit: "kg", stock: 3, min_stock: 2 },
    { name: "Siyah zeytin", unit: "kg", stock: 2.5, min_stock: 1 },
    { name: "Susam", unit: "kg", stock: 3, min_stock: 1 },
    { name: "Maya", unit: "kg", stock: 1.2, min_stock: 0.5 },
    { name: "Pekmez", unit: "kg", stock: 4, min_stock: 1 },
  ],
  products: [
    { name: "Peynirli poğaça", emoji: "", unit: "adet", price: 25, stock: 30, min_stock: 15, weight_g: 80,
      recipe: { "Un": 0.045, "Tereyağı": 0.008, "Margarin": 0.006, "Yumurta": 0.1, "Süt": 0.015, "Beyaz peynir": 0.015, "Maya": 0.001 } },
    { name: "Zeytinli poğaça", emoji: "", unit: "adet", price: 25, stock: 20, min_stock: 12, weight_g: 80,
      recipe: { "Un": 0.045, "Tereyağı": 0.008, "Margarin": 0.006, "Yumurta": 0.1, "Süt": 0.015, "Siyah zeytin": 0.012, "Maya": 0.001 } },
    { name: "Açma", emoji: "", unit: "adet", price: 22, stock: 20, min_stock: 12, weight_g: 90,
      recipe: { "Un": 0.055, "Margarin": 0.012, "Toz şeker": 0.005, "Süt": 0.02, "Maya": 0.0015 } },
    { name: "Simit", emoji: "", unit: "adet", price: 15, stock: 25, min_stock: 15, weight_g: 100,
      recipe: { "Un": 0.07, "Pekmez": 0.01, "Susam": 0.012, "Maya": 0.001 } },
    { name: "Su böreği", emoji: "", unit: "porsiyon", price: 90, stock: 6, min_stock: 6, weight_g: 200,
      recipe: { "Un": 0.06, "Yumurta": 0.6, "Tereyağı": 0.03, "Beyaz peynir": 0.05, "Süt": 0.03 } },
    { name: "Tuzlu kurabiye (250 g)", emoji: "", unit: "paket", price: 85, stock: 10, min_stock: 4, weight_g: 250,
      recipe: { "Un": 0.12, "Margarin": 0.07, "Yumurta": 0.5, "Susam": 0.008 } },
    { name: "Un kurabiyesi (250 g)", emoji: "", unit: "paket", price: 90, stock: 9, min_stock: 4, weight_g: 250,
      recipe: { "Un": 0.12, "Tereyağı": 0.08, "Pudra şekeri": 0.05 } },
    { name: "Ekler", emoji: "", unit: "adet", price: 30, stock: 15, min_stock: 10, weight_g: 60,
      recipe: { "Un": 0.012, "Tereyağı": 0.008, "Yumurta": 0.3, "Krema": 0.025, "Bitter çikolata": 0.01 } },
    { name: "Profiterol", emoji: "", unit: "porsiyon", price: 120, stock: 5, min_stock: 4, weight_g: 180,
      recipe: { "Un": 0.03, "Tereyağı": 0.02, "Yumurta": 0.8, "Krema": 0.06, "Bitter çikolata": 0.04, "Süt": 0.08 } },
    { name: "Supangle", emoji: "", unit: "porsiyon", price: 90, stock: 7, min_stock: 4, weight_g: 200,
      recipe: { "Süt": 0.2, "Kakao": 0.012, "Toz şeker": 0.03, "Un": 0.015, "Bitter çikolata": 0.01 } },
    { name: "Trileçe dilim", emoji: "", unit: "dilim", price: 100, stock: 8, min_stock: 4, weight_g: 160,
      recipe: { "Un": 0.02, "Yumurta": 0.4, "Süt": 0.12, "Krema": 0.03, "Toz şeker": 0.025 } },
    { name: "Tiramisu dilim", emoji: "", unit: "dilim", price: 130, stock: 6, min_stock: 3, weight_g: 140,
      recipe: { "Krem peynir": 0.06, "Krema": 0.04, "Yumurta": 0.3, "Toz şeker": 0.02, "Kakao": 0.004 } },
    { name: "Cheesecake dilim", emoji: "", unit: "dilim", price: 140, stock: 6, min_stock: 4, weight_g: 140,
      recipe: { "Krem peynir": 0.09, "Toz şeker": 0.02, "Yumurta": 0.4, "Krema": 0.025, "Tereyağı": 0.01 } },
    { name: "Yaş pasta dilim", emoji: "", unit: "dilim", price: 110, stock: 8, min_stock: 6, weight_g: 150,
      recipe: { "Un": 0.025, "Toz şeker": 0.025, "Yumurta": 0.5, "Krema": 0.05, "Taze meyve": 0.03, "Süt": 0.04 } },
    { name: "Çikolatalı pasta", emoji: "", unit: "bütün", price: 950, stock: 1, min_stock: 2, weight_g: 1200,
      recipe: { "Un": 0.25, "Toz şeker": 0.25, "Yumurta": 6, "Krema": 0.5, "Bitter çikolata": 0.3, "Süt": 0.3 } },
    { name: "Meyveli pasta", emoji: "", unit: "bütün", price: 900, stock: 1, min_stock: 2, weight_g: 1100,
      recipe: { "Un": 0.25, "Toz şeker": 0.25, "Yumurta": 6, "Krema": 0.6, "Taze meyve": 0.35, "Süt": 0.3 } },
    { name: "Doğum günü pastası (8 kişilik)", emoji: "", unit: "bütün", price: 1250, stock: 0, min_stock: 1, weight_g: 1600,
      recipe: { "Un": 0.35, "Toz şeker": 0.3, "Yumurta": 8, "Krema": 0.7, "Taze meyve": 0.3, "Süt": 0.4 } },
  ],
};
