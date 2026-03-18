# Compatibility Tests Documentation

This directory contains comprehensive compatibility tests to validate that the Google Ads integration does not affect existing Meta Ads functionality and that the system works correctly with different platform connection combinations.

## Test Coverage

### Requirements Covered
- **11.1**: Preserve all existing Meta_Ads_Platform routes and functionality
- **11.2**: Maintain backward compatibility with existing database schemas
- **11.3**: Not modify existing RLS policies for Meta_Ads_Platform tables
- **11.4**: Keep the existing "Campanhas" menu and all Meta-specific features unchanged
- **11.5**: Ensure that Clients with only Meta connections continue to function identically

## Test Structure

### 1. Meta Platform Compatibility Tests
**File**: `meta-platform-compatibility.test.ts`

**Purpose**: Validates that Meta Ads functionality remains completely unaffected by Google Ads integration.

**Test Categories**:
- **Meta Database Operations**: Ensures Meta table structures, RLS policies, and relationships are preserved
- **Meta API Compatibility**: Validates Meta API response structures and field mappings remain unchanged
- **Meta Service Layer Compatibility**: Tests Meta client functionality, sync services, and error handling
- **Meta UI Component Compatibility**: Verifies Meta component interfaces and dashboard structures
- **Meta Configuration and Environment**: Ensures Meta environment variables and configurations are preserved
- **Meta Route Compatibility**: Validates Meta API routes and parameters remain functional
- **Backward Compatibility**: Tests legacy URL support and data migration compatibility

**Key Validations**:
- Meta-specific fields (objective, reach, frequency, daily_budget) are preserved
- Meta status values (ACTIVE/PAUSED/DELETED) work correctly
- Meta API response structure matches existing format
- Meta error handling works independently of Google integration
- Meta environment variables (META_APP_ID, META_APP_SECRET, etc.) are maintained

### 2. Platform Connection Scenarios Tests
**File**: `platform-connection-scenarios.test.ts`

**Purpose**: Tests system behavior with different combinations of platform connections.

**Test Scenarios**:

#### Meta Only Connected
- System functions normally with only Meta connected
- Appropriate Google connection prompts are shown
- Meta operations work without Google interference
- Unified dashboard shows Meta data with partial data warning

#### Google Only Connected
- System functions normally with only Google connected
- Google-specific data formats are preserved
- Meta connection prompts are shown appropriately
- Unified dashboard shows Google data with partial data warning

#### Both Platforms Connected
- Data aggregation works correctly across platforms
- Unified operations (sync, export) work across platforms
- Comprehensive platform comparison is available
- All advanced features are enabled

#### No Platforms Connected
- Comprehensive onboarding experience is shown
- Business-specific guidance is provided
- Empty state is handled gracefully
- User guidance and help resources are available

**Error Handling**:
- Partial platform failures are handled gracefully
- System recovers from temporary connection issues
- Data isolation is maintained during errors

### 3. System Compatibility Validation E2E Tests
**File**: `system-compatibility-validation.spec.ts`

**Purpose**: End-to-end validation of system compatibility across different scenarios.

**Test Categories**:

#### Meta Functionality Preservation
- Meta dashboard functionality is preserved
- Meta sync functionality works correctly
- Meta export functionality is maintained
- Meta campaign details work properly
- Meta navigation and breadcrumbs are preserved

#### System Behavior with Different Connection States
- Meta-only connection handling
- Google-only connection handling
- Both platforms connected behavior
- No platforms connected onboarding

#### Error Handling and Resilience
- Meta API errors don't affect Google functionality
- Google API errors don't affect Meta functionality
- Recovery from temporary connection issues

#### Data Isolation and Security
- Data isolation between platforms is maintained
- Cross-platform data contamination is prevented
- API calls are properly isolated

#### Performance and User Experience
- Acceptable performance with both platforms
- Smooth navigation between platforms
- Efficient handling of large datasets

## Test Data and Mocking

### Mock Data Structure

#### Meta Mock Data
```typescript
meta: {
  campaigns: [
    {
      id: 'meta-campaign-1',
      campaign_id: 'meta-123',
      name: 'Meta Test Campaign',
      status: 'ACTIVE',
      objective: 'CONVERSIONS',
      impressions: 15000,
      clicks: 750,
      conversions: 37,
      spend: 125.00,
      reach: 12000,        // Meta-specific
      frequency: 1.25,     // Meta-specific
    }
  ],
  connection: {
    accountId: '9876543210',
    accountName: 'Test Meta Account',
    status: 'active',
  }
}
```

#### Google Mock Data
```typescript
google: {
  campaigns: [
    {
      id: 'google-campaign-1',
      campaignId: '12345',
      campaignName: 'Google Test Campaign',    // Google uses campaignName
      status: 'ENABLED',                       // Google uses ENABLED/PAUSED/REMOVED
      advertisingChannelType: 'SEARCH',        // Google-specific
      impressions: 12000,
      clicks: 600,
      conversions: 30,
      cost: 90.00,                            // Google uses 'cost' not 'spend'
      searchImpressionShare: 85.5,            // Google-specific
      qualityScore: 7.2,                      // Google-specific
    }
  ],
  connection: {
    customerId: '1234567890',
    accountName: 'Test Google Account',
    status: 'active',
  }
}
```

### API Mocking Strategy

#### Meta API Mocks
- `/api/meta/campaigns` - Returns Meta campaigns with Meta-specific fields
- `/api/meta/connections` - Returns Meta connection status
- `/api/meta/sync` - Simulates Meta sync operations
- `/api/meta/insights` - Returns Meta-specific metrics (reach, frequency, etc.)

#### Google API Mocks
- `/api/google/campaigns` - Returns Google campaigns with Google-specific fields
- `/api/google/connections` - Returns Google connection status
- `/api/google/sync` - Simulates Google sync operations
- `/api/google/metrics` - Returns Google-specific metrics (search impression share, quality score, etc.)

#### Unified API Mocks
- `/api/unified/metrics` - Returns aggregated data from both platforms
- `/api/unified/comparison` - Returns platform comparison data

## Running the Tests

### Unit and Integration Tests
```bash
# Run all compatibility tests
npm test -- --testPathPattern="compatibility"

# Run specific test file
npm test meta-platform-compatibility.test.ts
npm test platform-connection-scenarios.test.ts

# Run with coverage
npm test -- --coverage --testPathPattern="compatibility"
```

### E2E Tests
```bash
# Run E2E compatibility tests
npm run test:e2e -- --grep "System Compatibility Validation"

# Run with UI mode for debugging
npm run test:e2e:ui -- --grep "System Compatibility Validation"

# Run specific E2E test
npx playwright test system-compatibility-validation.spec.ts
```

## Test Validation Criteria

### Meta Functionality Preservation
✅ All existing Meta routes work unchanged  
✅ Meta database schema is preserved  
✅ Meta API responses maintain existing structure  
✅ Meta-specific fields (objective, reach, frequency) are available  
✅ Meta error handling works independently  
✅ Meta sync and export functionality is maintained  

### Platform Isolation
✅ Meta operations don't trigger Google API calls  
✅ Google operations don't trigger Meta API calls  
✅ Data contamination between platforms is prevented  
✅ RLS policies work independently for each platform  

### System Resilience
✅ Meta API errors don't affect Google functionality  
✅ Google API errors don't affect Meta functionality  
✅ Partial platform failures are handled gracefully  
✅ System recovers from temporary connection issues  

### User Experience
✅ Navigation between platforms is smooth  
✅ Performance is acceptable with both platforms  
✅ Onboarding works when no platforms are connected  
✅ Appropriate prompts are shown for unconnected platforms  

## Troubleshooting

### Common Issues

#### Test Failures Related to Mock Data
- **Issue**: Tests fail because mock data doesn't match expected structure
- **Solution**: Verify mock data matches the actual API response structure
- **Check**: Ensure Meta and Google mock data have platform-specific fields

#### API Route Mocking Issues
- **Issue**: API calls are not being intercepted correctly
- **Solution**: Check route patterns and ensure they match actual API endpoints
- **Debug**: Use `page.on('request')` to monitor actual API calls

#### Component Not Found Errors
- **Issue**: Test can't find expected UI components
- **Solution**: Verify component test IDs match actual implementation
- **Check**: Ensure components are rendered conditionally based on connection state

#### Performance Test Failures
- **Issue**: Tests fail due to slow loading times
- **Solution**: Increase timeout values or optimize mock responses
- **Check**: Verify large dataset mocks are not too large for test environment

### Debugging Tips

1. **Use Console Logging**: Add console.log statements to track test execution
2. **Screenshot on Failure**: Use `await page.screenshot()` to capture state
3. **Network Monitoring**: Monitor API calls with `page.on('request')`
4. **Step-by-Step Debugging**: Use `page.pause()` for interactive debugging
5. **Mock Verification**: Verify mocks are being called with expected parameters

## Maintenance

### When to Update Tests

1. **New Meta Features**: Add tests when new Meta functionality is added
2. **API Changes**: Update mocks when API response structures change
3. **UI Changes**: Update selectors when component structures change
4. **New Error Scenarios**: Add tests for new error handling cases

### Test Data Maintenance

1. **Keep Mock Data Realistic**: Ensure mock data reflects real API responses
2. **Update Field Names**: Keep field names consistent with actual APIs
3. **Maintain Platform Differences**: Preserve differences between Meta and Google data structures
4. **Version Compatibility**: Update mocks when API versions change

## Best Practices

1. **Test Independence**: Each test should be independent and not rely on others
2. **Clear Assertions**: Use descriptive assertion messages
3. **Comprehensive Coverage**: Test both positive and negative scenarios
4. **Performance Awareness**: Keep tests fast and efficient
5. **Maintainable Mocks**: Use helper functions for common mock setups
6. **Documentation**: Document complex test scenarios and edge cases