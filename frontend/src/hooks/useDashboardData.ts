import { useMutation, useQuery } from '@tanstack/react-query';
import { getAnalytics, getArchitectureInsights, getDependencyGraph } from '../api/analytics';
import { getProfile } from '../api/auth';
import { getReviewJobs, getReviewSettings, getWebhookDeliveries } from '../api/operations';
import { getRepositories } from '../api/repositories';
import { getReview, getReviews, reanalyzeReview, type ReviewFilters } from '../api/reviews';

export const useAnalytics = () =>
  useQuery({ queryKey: ['analytics'], queryFn: getAnalytics });

export const useRepositories = () =>
  useQuery({ queryKey: ['repositories'], queryFn: getRepositories });

export const useReviews = (filters: ReviewFilters = {}) =>
  useQuery({
    queryKey: ['reviews', filters],
    queryFn: () => getReviews(filters),
  });

export const useReview = (id?: string) =>
  useQuery({
    queryKey: ['review', id],
    queryFn: () => getReview(id!),
    enabled: Boolean(id),
  });

export const useArchitecture = () =>
  useQuery({ queryKey: ['architecture'], queryFn: getArchitectureInsights });

export const useDependencyGraph = (repository?: string) =>
  useQuery({
    queryKey: ['dependency-graph', repository],
    queryFn: () => getDependencyGraph(repository),
  });

export const useProfile = () =>
  useQuery({ queryKey: ['profile'], queryFn: getProfile });

export const useReviewJobs = () =>
  useQuery({ queryKey: ['review-jobs'], queryFn: getReviewJobs, refetchInterval: 5000 });

export const useWebhookDeliveries = () =>
  useQuery({ queryKey: ['webhook-deliveries'], queryFn: getWebhookDeliveries, refetchInterval: 10000 });

export const useReviewSettings = () =>
  useQuery({ queryKey: ['review-settings'], queryFn: getReviewSettings });

export const useReanalyzeReview = () =>
  useMutation({ mutationFn: reanalyzeReview });
