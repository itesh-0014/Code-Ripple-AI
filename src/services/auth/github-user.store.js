import mongoose from 'mongoose';

const COLLECTION_NAME = 'users';

export class GitHubUserStore {
  async upsertFromGitHubProfile(profile, { accessToken = null } = {}) {
    if (mongoose.connection.readyState !== 1) {
      const error = new Error('MongoDB is not connected.');
      error.code = 'MONGODB_NOT_CONNECTED';
      throw error;
    }

    const now = new Date();
    const user = {
      id: String(profile.id),
      githubId: String(profile.id),
      login: profile.login,
      name: profile.name || profile.login,
      avatarUrl: profile.avatar_url,
      email: profile.email || null,
      htmlUrl: profile.html_url,
      provider: 'github',
      plan: 'Developer',
      demo: false,
    };

    const result = await mongoose.connection.db.collection(COLLECTION_NAME).findOneAndUpdate(
      { provider: 'github', githubId: user.githubId },
      {
        $set: {
          ...user,
          ...(accessToken ? { githubAccessToken: accessToken } : {}),
          updatedAt: now,
          lastLoginAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      {
        returnDocument: 'after',
        upsert: true,
      }
    );

    return normalizeUser(result);
  }

  async getAccessTokenForUser(user) {
    if (!user?.id && !user?.dbId) return null;

    if (mongoose.connection.readyState !== 1) {
      return null;
    }

    const query = user.dbId
      ? { _id: new mongoose.Types.ObjectId(user.dbId) }
      : { provider: 'github', githubId: String(user.id) };
    const document = await mongoose.connection.db.collection(COLLECTION_NAME).findOne(query, {
      projection: { githubAccessToken: 1 },
    });

    return document?.githubAccessToken || null;
  }
}

function normalizeUser(document) {
  return {
    id: document.githubId || String(document._id),
    dbId: String(document._id),
    login: document.login,
    name: document.name || document.login,
    avatarUrl: document.avatarUrl,
    email: document.email || null,
    plan: document.plan || 'Developer',
    demo: Boolean(document.demo),
  };
}

export const githubUserStore = new GitHubUserStore();
