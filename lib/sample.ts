// Sample bakery used by "Örnek verileri yükle". Prices and recipes are illustrative starting points.
type SampleProduct = {
  name: string; emoji: string; unit: string; price: number; stock: number; min_stock: number; weight_g: number;
  recipe: Record<string, number>; // ingredient name → amount per unit
};

export const SAMPLE_BAKERY: {
  ingredients: { name: string; unit: string; stock: number; min_stock: number }[];
  products: SampleProduct[];
} = {
  ingredients: [
    { name: "Un", unit: "kg", stock: 40, min_stock: 15 },
    { name: "Toz şeker", unit: "kg", stock: 18, min_stock: 8 },
    { name: "Tereyağı", unit: "kg", stock: 9, min_stock: 4 },
    { name: "Yumurta", unit: "adet", stock: 180, min_stock: 60 },
    { name: "Süt", unit: "L", stock: 20, min_stock: 8 },
    { name: "Krema", unit: "L", stock: 6, min_stock: 5 },
    { name: "Bitter çikolata", unit: "kg", stock: 4, min_stock: 3 },
    { name: "Taze meyve", unit: "kg", stock: 3, min_stock: 2 },
    { name: "Beyaz peynir", unit: "kg", stock: 5, min_stock: 2 },
    { name: "Krem peynir", unit: "kg", stock: 2.5, min_stock: 2 },
  ],
  products: [
    { name: "Peynirli poğaça", emoji: "🥐", unit: "adet", price: 25, stock: 40, min_stock: 15, weight_g: 80,
      recipe: { "Un": 0.05, "Tereyağı": 0.01, "Yumurta": 0.1, "Süt": 0.02, "Beyaz peynir": 0.015 } },
    { name: "Açma", emoji: "🥯", unit: "adet", price: 22, stock: 30, min_stock: 12, weight_g: 90,
      recipe: { "Un": 0.06, "Tereyağı": 0.012, "Toz şeker": 0.005, "Süt": 0.02 } },
    { name: "Kurabiye (250 g)", emoji: "🍪", unit: "paket", price: 90, stock: 14, min_stock: 5, weight_g: 250,
      recipe: { "Un": 0.12, "Tereyağı": 0.06, "Toz şeker": 0.05, "Yumurta": 0.5 } },
    { name: "Ekler", emoji: "🥖", unit: "adet", price: 30, stock: 24, min_stock: 10, weight_g: 60,
      recipe: { "Un": 0.015, "Tereyağı": 0.01, "Yumurta": 0.3, "Krema": 0.03, "Bitter çikolata": 0.01 } },
    { name: "Profiterol", emoji: "🍮", unit: "porsiyon", price: 120, stock: 10, min_stock: 4, weight_g: 180,
      recipe: { "Un": 0.04, "Tereyağı": 0.03, "Yumurta": 1, "Krema": 0.1, "Bitter çikolata": 0.06, "Süt": 0.1 } },
    { name: "Cheesecake dilim", emoji: "🍰", unit: "dilim", price: 140, stock: 8, min_stock: 4, weight_g: 140,
      recipe: { "Krem peynir": 0.1, "Toz şeker": 0.02, "Yumurta": 0.4, "Krema": 0.03, "Tereyağı": 0.01 } },
    { name: "Yaş pasta dilim", emoji: "🧁", unit: "dilim", price: 110, stock: 12, min_stock: 6, weight_g: 150,
      recipe: { "Un": 0.03, "Toz şeker": 0.03, "Yumurta": 0.5, "Krema": 0.06, "Taze meyve": 0.03, "Süt": 0.05 } },
    { name: "Çikolatalı pasta", emoji: "🎂", unit: "bütün", price: 950, stock: 3, min_stock: 2, weight_g: 1200,
      recipe: { "Un": 0.3, "Toz şeker": 0.3, "Yumurta": 6, "Krema": 0.6, "Bitter çikolata": 0.35, "Süt": 0.4 } },
    { name: "Meyveli pasta", emoji: "🍓", unit: "bütün", price: 900, stock: 2, min_stock: 2, weight_g: 1100,
      recipe: { "Un": 0.3, "Toz şeker": 0.3, "Yumurta": 6, "Krema": 0.7, "Taze meyve": 0.4, "Süt": 0.4 } },
  ],
};
