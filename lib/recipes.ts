export const categories = ['Dành cho bạn', 'Ăn vặt', 'Bình dân', 'Việt Nam']
const baseRecipes = [
  { id: 1, title: 'Bánh mì giòn, đầy ắp hương vị Việt', food: '🥖', tags: ['Việt Nam', 'Bình dân'], author: 'Vua đầu bếp', views: 100, minutes: 20, description: 'Vỏ bánh giòn rụm, nhân trứng béo thơm cùng dưa leo và đồ chua. Một bữa sáng quen thuộc, dễ làm ngay tại nhà.', ingredients: 'Bánh mì, trứng, dưa leo, cà rốt ngâm chua, rau mùi, nước tương.', steps: ['Làm nóng bánh mì cho vỏ giòn.', 'Chiên trứng theo sở thích, thái dưa leo.', 'Xẻ bánh, thêm nhân, rau và nước tương. Thưởng thức ngay.'] },
  { id: 2, title: 'Bánh tráng trộn cho buổi chiều thảnh thơi', food: '🥗', tags: ['Ăn vặt', 'Việt Nam'], author: 'Bếp của An', views: 248, minutes: 15, description: 'Chua nhẹ, cay vừa, thêm chút giòn từ đậu phộng. Món ăn vặt để cùng bạn bè nhâm nhi.', ingredients: 'Bánh tráng, xoài xanh, trứng cút, rau răm, đậu phộng, nước sốt.', steps: ['Cắt bánh tráng, bào xoài và luộc trứng cút.', 'Trộn các nguyên liệu cùng nước sốt.', 'Thêm đậu phộng, rau răm và dùng ngay.'] },
  { id: 3, title: 'Cơm trứng đơn giản cho ngày bận rộn', food: '🍳', tags: ['Bình dân', 'Việt Nam'], author: 'Một góc bếp nhỏ', views: 186, minutes: 10, description: 'Chỉ vài nguyên liệu có sẵn, một bữa cơm nóng hổi vẫn đủ làm ngày dài dễ chịu hơn.', ingredients: 'Cơm nóng, trứng, hành lá, nước tương, dưa leo.', steps: ['Chiên trứng, giữ lòng đào nếu thích.', 'Pha nước tương cùng hành lá.', 'Xếp trứng lên cơm, rưới sốt và ăn kèm dưa leo.'] },
]


// Deterministic UI fixtures: stable IDs keep saved recipes and detail routes working.
export const recipes = Array.from({ length: 36 }, (_, index) => {
  const original = baseRecipes[index % baseRecipes.length]
  const batch = Math.floor(index / baseRecipes.length)
  return {
    ...original,
    id: index + 1,
    artId: original.id,
    title: batch === 0 ? original.title : `${original.title} · Bếp thử ${batch + 1}`,
    views: original.views + batch * 23,
  }
})

// Build an author directory before filtering or rendering post fixtures.
const authorDirectory = new Map<string, typeof recipes[number] & { recipeCount: number }>()
for (const recipe of recipes) {
  const existing = authorDirectory.get(recipe.author)
  if (existing) existing.recipeCount += 1
  else authorDirectory.set(recipe.author, { ...recipe, recipeCount: 1 })
}
export const demoAuthors = Array.from(authorDirectory.values())
