import { getAllPosts } from "@/lib/blog";
import { BlogIndexClient } from "@/app/blog/_components/blog-index-client";

export default function BlogPage() {
  const posts = getAllPosts();
  return <BlogIndexClient posts={posts} />;
}
