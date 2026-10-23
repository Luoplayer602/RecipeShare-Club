import type { PostBlockData } from '@/db/schema'

export type SessionUser = { id: string; username: string; displayName: string; role: string; titleId: number; titleName: string; avatarUrl: string | null }
export type Tag = { id: string; name: string; slug: string }
export type RecipeFacts = { prepMinutes: number | null; cookMinutes: number | null; servings: number | null; difficulty: number | null }
export type PostSummary = {
  id: string; type: 'recipe' | 'blog'; title: string; slug: string; excerpt: string;
  coverMediaId: string | null; coverUrl: string | null; publishedAt: string;
  author: { id: string; username: string; displayName: string; titleName: string; avatarUrl: string | null };
  recipe: RecipeFacts | null; tags: Tag[];
}
export type PostDetail = Omit<PostSummary, 'recipe' | 'coverUrl'> & {
  updatedAt: string;
  recipe: (RecipeFacts & { ingredients: { name: string; quantity: string | null; unit: string | null; note: string | null; position: number }[] }) | null;
  blocks: { data: PostBlockData; position: number }[];
  media: { id: string; kind: 'image' | 'video'; source: 'upload' | 'url'; mimeType: string | null; url: string | null }[];
}
export type PopularTag = Tag & { postCount: number }
export type PostList = { popularTags: PopularTag[]; selectedTag: Tag | null; selectedTags?: Tag[]; posts: PostSummary[]; pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean } }
