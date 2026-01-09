"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Star, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card";
import { RatingDisplay } from "@/components/reviews";
import { formatDistanceToNow } from "date-fns";

interface Review {
  id: string;
  rating: number;
  content: string | null;
  createdAt: Date | null;
  server: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

interface ProfileTabsProps {
  username: string;
  initialReviews?: Review[];
}

export function ProfileTabs({ username, initialReviews = [] }: ProfileTabsProps) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [isLoading, setIsLoading] = useState(initialReviews.length === 0);

  useEffect(() => {
    if (initialReviews.length === 0) {
      fetchReviews();
    }
  }, [username]);

  const fetchReviews = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/users/${username}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch reviews:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Tabs defaultValue="reviews" className="w-full">
      <TabsList className="grid w-full grid-cols-2 max-w-xs">
        <TabsTrigger value="reviews">Reviews</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>

      <TabsContent value="reviews" className="mt-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : reviews.length === 0 ? (
          <GlassCard>
            <GlassCardContent className="p-8 text-center text-muted-foreground">
              No reviews yet
            </GlassCardContent>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <GlassCard key={review.id}>
                <GlassCardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {review.server && (
                        <Link
                          href={`/servers/${review.server.slug}`}
                          className="font-medium hover:text-cyan transition-colors"
                        >
                          {review.server.name}
                        </Link>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <RatingDisplay rating={review.rating} size="sm" />
                        {review.createdAt && (
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                      {review.content && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {review.content}
                        </p>
                      )}
                    </div>
                  </div>
                </GlassCardContent>
              </GlassCard>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="activity" className="mt-6">
        <GlassCard>
          <GlassCardContent className="p-8 text-center text-muted-foreground">
            Activity feed coming soon
          </GlassCardContent>
        </GlassCard>
      </TabsContent>
    </Tabs>
  );
}
