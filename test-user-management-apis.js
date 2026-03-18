/**
 * Test script for User Management APIs
 * Tests the endpoints created for Task 6
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testUserManagementAPIs() {
  console.log('🧪 Testing User Management APIs...\n');

  try {
    // 1. Test GET /api/admin/users (list users)
    console.log('1. Testing GET /api/admin/users');
    const listResponse = await fetch('http://localhost:3000/api/admin/users', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (listResponse.ok) {
      const listData = await listResponse.json();
      console.log('✅ GET /api/admin/users - Success');
      console.log(`   Found ${listData.users?.length || 0} users`);
      console.log(`   Stats: ${JSON.stringify(listData.stats)}`);
    } else {
      const error = await listResponse.text();
      console.log('❌ GET /api/admin/users - Failed');
      console.log(`   Status: ${listResponse.status}`);
      console.log(`   Error: ${error}`);
    }

    console.log('');

    // 2. Test POST /api/admin/users (create user)
    console.log('2. Testing POST /api/admin/users');
    
    // First, get an organization to use
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('is_active', true)
      .limit(1);

    if (orgError || !orgs || orgs.length === 0) {
      console.log('❌ No organizations found for testing user creation');
      return;
    }

    const testOrg = orgs[0];
    const testUserData = {
      email: `test-user-${Date.now()}@example.com`,
      name: 'Test User API',
      role: 'member',
      organizationId: testOrg.id
    };

    const createResponse = await fetch('http://localhost:3000/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUserData)
    });

    let createdUserId = null;
    if (createResponse.ok) {
      const createData = await createResponse.json();
      createdUserId = createData.user?.id;
      console.log('✅ POST /api/admin/users - Success');
      console.log(`   Created user: ${createData.user?.email}`);
      console.log(`   User ID: ${createdUserId}`);
    } else {
      const error = await createResponse.text();
      console.log('❌ POST /api/admin/users - Failed');
      console.log(`   Status: ${createResponse.status}`);
      console.log(`   Error: ${error}`);
    }

    console.log('');

    // 3. Test GET /api/admin/users/[userId] (get specific user)
    if (createdUserId) {
      console.log('3. Testing GET /api/admin/users/[userId]');
      const getUserResponse = await fetch(`http://localhost:3000/api/admin/users/${createdUserId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (getUserResponse.ok) {
        const userData = await getUserResponse.json();
        console.log('✅ GET /api/admin/users/[userId] - Success');
        console.log(`   User: ${userData.user?.email}`);
        console.log(`   Organizations: ${userData.user?.organizations?.length || 0}`);
      } else {
        const error = await getUserResponse.text();
        console.log('❌ GET /api/admin/users/[userId] - Failed');
        console.log(`   Status: ${getUserResponse.status}`);
        console.log(`   Error: ${error}`);
      }

      console.log('');

      // 4. Test PUT /api/admin/users/[userId] (update user)
      console.log('4. Testing PUT /api/admin/users/[userId]');
      const updateData = {
        name: 'Updated Test User API',
        role: 'admin'
      };

      const updateResponse = await fetch(`http://localhost:3000/api/admin/users/${createdUserId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      if (updateResponse.ok) {
        const updateResult = await updateResponse.json();
        console.log('✅ PUT /api/admin/users/[userId] - Success');
        console.log(`   Updated user: ${updateResult.user?.name}`);
        console.log(`   New role: ${updateResult.user?.organizations?.[0]?.role}`);
      } else {
        const error = await updateResponse.text();
        console.log('❌ PUT /api/admin/users/[userId] - Failed');
        console.log(`   Status: ${updateResponse.status}`);
        console.log(`   Error: ${error}`);
      }

      console.log('');

      // 5. Test DELETE /api/admin/users/[userId] (delete user)
      console.log('5. Testing DELETE /api/admin/users/[userId]');
      const deleteResponse = await fetch(`http://localhost:3000/api/admin/users/${createdUserId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (deleteResponse.ok) {
        const deleteResult = await deleteResponse.json();
        console.log('✅ DELETE /api/admin/users/[userId] - Success');
        console.log(`   Message: ${deleteResult.message}`);
      } else {
        const error = await deleteResponse.text();
        console.log('❌ DELETE /api/admin/users/[userId] - Failed');
        console.log(`   Status: ${deleteResponse.status}`);
        console.log(`   Error: ${error}`);
      }
    }

    console.log('\n🎉 User Management API testing completed!');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
if (require.main === module) {
  testUserManagementAPIs();
}

module.exports = { testUserManagementAPIs };