import request from 'supertest';
import app from '../../src/app';

describe('Restricted List Management', () => {
  let authToken: string;
  let testUserId: string;
  let restrictedUserId: string;

  beforeAll(async () => {
    // Create test user and get auth token
    const registerResponse = await request(app)
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
      });

    testUserId = registerResponse.body.data.user.id;

    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });

    authToken = loginResponse.body.data.token;

    // Create user to restrict
    const restrictedUserResponse = await request(app)
      .post('/auth/register')
      .send({
        email: 'restricted@example.com',
        password: 'password123',
        firstName: 'Restricted',
        lastName: 'User',
      });

    restrictedUserId = restrictedUserResponse.body.data.user.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await request(app)
      .delete('/auth/delete-account')
      .set('Authorization', `Bearer ${authToken}`);
  });

  describe('POST /privacy/restrict', () => {
    it('should add user to restricted list', async () => {
      const response = await request(app)
        .post('/privacy/restrict')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ restrictedUserId });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.message).toContain('added to restricted list');
    });

    it('should not allow restricting self', async () => {
      const response = await request(app)
        .post('/privacy/restrict')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ restrictedUserId: testUserId });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Cannot restrict yourself');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/privacy/restrict')
        .send({ restrictedUserId });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /privacy/restricted-list', () => {
    it('should get restricted list', async () => {
      const response = await request(app)
        .get('/privacy/restricted-list')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('id');
      expect(response.body.data[0]).toHaveProperty('firstName');
      expect(response.body.data[0]).toHaveProperty('lastName');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/privacy/restricted-list');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /privacy/unrestrict', () => {
    it('should remove user from restricted list', async () => {
      const response = await request(app)
        .post('/privacy/unrestrict')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ restrictedUserId });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.message).toContain('removed from restricted list');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/privacy/unrestrict')
        .send({ restrictedUserId });

      expect(response.status).toBe(401);
    });
  });
});
