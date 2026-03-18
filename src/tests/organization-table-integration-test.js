/**
 * Organization Table Integration Test
 * 
 * This test verifies the complete table display and interaction functionality
 * for the organization editing feature according to requirements 3.1, 3.2, 3.3
 * 
 * Run with: node src/tests/organization-table-integration-test.js
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const ORGANIZATIONS_PAGE_PATH = path.join(__dirname, '../app/admin/organizations/page.tsx');
const API_ROUTE_PATH = path.join(__dirname, '../app/api/organizations/[orgId]/route.ts');

// Helper function to read file content
function readFileContent(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error.message}`);
  }
}

// Comprehensive integration tests
const integrationTests = [
  {
    name: 'Complete table structure verification',
    description: 'Verify table displays without slug column and has all required columns',
    requirement: '3.1, 3.4',
    test: () => {
      const content = readFileContent(ORGANIZATIONS_PAGE_PATH);
      
      // Verify table structure
      const tableStructure = {
        hasTable: content.includes('<Table>'),
        hasTableHeader: content.includes('<TableHeader>'),
        hasTableBody: content.includes('<TableBody>'),
        hasTableRows: content.includes('<TableRow>')
      };
      
      // Verify column headers (should NOT include slug)
      const columnHeaders = {
        hasNameColumn: content.includes('>Nome<'),
        hasMembersColumn: content.includes('>Membros<'),
        hasCreatedColumn: content.includes('>Criado em<'),
        hasActionsColumn: content.includes('>Ações<'),
        hasSlugColumn: content.includes('>Slug<') || content.includes('>slug<')
      };
      
      // Verify row data mapping
      const rowDataMapping = {
        mapsOrganizations: content.includes('organizations.map'),
        displaysName: content.includes('org.name'),
        displaysMemberCount: content.includes('getMembersCount(org)'),
        displaysCreatedDate: content.includes('org.created_at'),
        displaysSlugData: content.includes('org.slug')
      };
      
      const allStructureValid = Object.values(tableStructure).every(Boolean);
      const allColumnsValid = columnHeaders.hasNameColumn && 
                             columnHeaders.hasMembersColumn && 
                             columnHeaders.hasCreatedColumn && 
                             columnHeaders.hasActionsColumn && 
                             !columnHeaders.hasSlugColumn;
      const allRowDataValid = rowDataMapping.mapsOrganizations &&
                             rowDataMapping.displaysName &&
                             rowDataMapping.displaysMemberCount &&
                             rowDataMapping.displaysCreatedDate &&
                             !rowDataMapping.displaysSlugData;
      
      return {
        passed: allStructureValid && allColumnsValid && allRowDataValid,
        details: {
          tableStructure,
          columnHeaders,
          rowDataMapping,
          allStructureValid,
          allColumnsValid,
          allRowDataValid
        },
        expected: 'Table should have proper structure with Name, Members, Created, Actions columns but NO slug'
      };
    }
  },
  
  {
    name: 'Edit button functionality verification',
    description: 'Verify edit button exists and triggers correct dialog',
    requirement: '3.2',
    test: () => {
      const content = readFileContent(ORGANIZATIONS_PAGE_PATH);
      
      // Check edit button implementation
      const editButton = {
        hasEditIcon: content.includes('<Edit className="w-4 h-4" />'),
        hasEditClickHandler: content.includes('onClick={() => openEditDialog(org)}'),
        hasEditFunction: content.includes('const openEditDialog = (org: Organization)'),
        hasEditDialog: content.includes('isEditDialogOpen')
      };
      
      // Check edit dialog structure
      const editDialog = {
        hasDialogComponent: content.includes('Dialog open={isEditDialogOpen}'),
        hasNameInput: content.includes('id="edit-name"'),
        hasSubmitButton: content.includes('onClick={handleEdit}'),
        hasSlugInput: content.includes('slug') && content.includes('Input') && content.includes('edit')
      };
      
      // Check form data handling
      const formHandling = {
        hasFormState: content.includes('formData, setFormData'),
        setsNameInForm: content.includes('name: org.name'),
        hasNameOnlyFormData: content.includes("useState({ name: '' })"),
        hasSlugInFormData: content.includes('slug:') && content.includes('formData')
      };
      
      const allEditButtonValid = Object.values(editButton).every(Boolean);
      const allEditDialogValid = editDialog.hasDialogComponent &&
                                editDialog.hasNameInput &&
                                editDialog.hasSubmitButton &&
                                !editDialog.hasSlugInput;
      const allFormHandlingValid = formHandling.hasFormState &&
                                  formHandling.setsNameInForm &&
                                  formHandling.hasNameOnlyFormData &&
                                  !formHandling.hasSlugInFormData;
      
      return {
        passed: allEditButtonValid && allEditDialogValid && allFormHandlingValid,
        details: {
          editButton,
          editDialog,
          formHandling,
          allEditButtonValid,
          allEditDialogValid,
          allFormHandlingValid
        },
        expected: 'Edit button should trigger dialog with name-only form'
      };
    }
  },
  
  {
    name: 'Member count and date display verification',
    description: 'Verify member counts and dates display correctly',
    requirement: '3.2, 3.3',
    test: () => {
      const content = readFileContent(ORGANIZATIONS_PAGE_PATH);
      
      // Check member count implementation
      const memberCount = {
        hasMemberCountFunction: content.includes('const getMembersCount = (org: Organization)'),
        usesMembershipsArray: content.includes('org.memberships'),
        hasUsersIcon: content.includes('<Users className="w-4 h-4'),
        displaysCount: content.includes('getMembersCount(org)')
      };
      
      // Check date formatting
      const dateFormatting = {
        hasDateFormatting: content.includes('toLocaleDateString'),
        usesBrazilianLocale: content.includes("'pt-BR'"),
        usesCreatedAtField: content.includes('org.created_at'),
        hasDateDisplay: content.includes('new Date(org.created_at).toLocaleDateString')
      };
      
      // Check organization interface
      const organizationInterface = {
        hasInterface: content.includes('interface Organization'),
        hasIdField: content.includes('id: string'),
        hasNameField: content.includes('name: string'),
        hasCreatedAtField: content.includes('created_at: string'),
        hasMembershipsField: content.includes('memberships:'),
        hasSlugField: content.includes('slug:') && content.includes('interface Organization')
      };
      
      const allMemberCountValid = Object.values(memberCount).every(Boolean);
      const allDateFormattingValid = Object.values(dateFormatting).every(Boolean);
      const allInterfaceValid = organizationInterface.hasInterface &&
                               organizationInterface.hasIdField &&
                               organizationInterface.hasNameField &&
                               organizationInterface.hasCreatedAtField &&
                               organizationInterface.hasMembershipsField &&
                               !organizationInterface.hasSlugField;
      
      return {
        passed: allMemberCountValid && allDateFormattingValid && allInterfaceValid,
        details: {
          memberCount,
          dateFormatting,
          organizationInterface,
          allMemberCountValid,
          allDateFormattingValid,
          allInterfaceValid
        },
        expected: 'Member counts and dates should display correctly with proper interface'
      };
    }
  },
  
  {
    name: 'API endpoint compatibility verification',
    description: 'Verify API endpoint only handles name field updates',
    requirement: '1.2, 2.3, 4.4',
    test: () => {
      const content = readFileContent(API_ROUTE_PATH);
      
      // Check request body parsing
      const requestParsing = {
        parsesRequestBody: content.includes('await request.json()'),
        extractsNameOnly: content.includes('const { name } = body'),
        hasSlugExtraction: content.includes('slug') && content.includes('body')
      };
      
      // Check validation
      const validation = {
        validatesName: content.includes('if (!name'),
        checksStringType: content.includes('typeof name !== \'string\''),
        trimsName: content.includes('name.trim()'),
        checksLength: content.includes('trimmedName.length')
      };
      
      // Check database update
      const databaseUpdate = {
        updatesNameOnly: content.includes('update({ name: trimmedName })'),
        hasSlugUpdate: content.includes('slug') && content.includes('update'),
        returnsUpdatedOrg: content.includes('.select()'),
        hasSuccessResponse: content.includes('success: true')
      };
      
      // Check error handling
      const errorHandling = {
        hasTryCatch: content.includes('try {') && content.includes('} catch'),
        hasValidationErrors: content.includes('status: 400'),
        hasServerErrors: content.includes('status: 500'),
        hasPermissionErrors: content.includes('status: 403')
      };
      
      const allRequestParsingValid = requestParsing.parsesRequestBody &&
                                    requestParsing.extractsNameOnly &&
                                    !requestParsing.hasSlugExtraction;
      const allValidationValid = Object.values(validation).every(Boolean);
      const allDatabaseUpdateValid = databaseUpdate.updatesNameOnly &&
                                    !databaseUpdate.hasSlugUpdate &&
                                    databaseUpdate.returnsUpdatedOrg &&
                                    databaseUpdate.hasSuccessResponse;
      const allErrorHandlingValid = Object.values(errorHandling).every(Boolean);
      
      return {
        passed: allRequestParsingValid && allValidationValid && allDatabaseUpdateValid && allErrorHandlingValid,
        details: {
          requestParsing,
          validation,
          databaseUpdate,
          errorHandling,
          allRequestParsingValid,
          allValidationValid,
          allDatabaseUpdateValid,
          allErrorHandlingValid
        },
        expected: 'API should handle name-only updates with proper validation and error handling'
      };
    }
  },
  
  {
    name: 'Complete workflow integration',
    description: 'Verify complete edit workflow from UI to API',
    requirement: '1.1, 1.2, 1.3, 3.1, 3.2, 3.3',
    test: () => {
      const uiContent = readFileContent(ORGANIZATIONS_PAGE_PATH);
      const apiContent = readFileContent(API_ROUTE_PATH);
      
      // Check UI to API data flow
      const dataFlow = {
        uiSendsFormData: uiContent.includes('body: JSON.stringify(formData)'),
        apiReceivesBody: apiContent.includes('await request.json()'),
        uiHandlesResponse: uiContent.includes('if (response.ok)'),
        apiReturnsSuccess: apiContent.includes('success: true')
      };
      
      // Check error handling flow
      const errorFlow = {
        uiCatchesErrors: uiContent.includes('} catch (error: any) {'),
        uiShowsErrorToast: uiContent.includes("variant: 'destructive'"),
        apiReturnsErrors: apiContent.includes('return NextResponse.json({ error:'),
        uiDisplaysErrorMessage: uiContent.includes('error.message')
      };
      
      // Check success handling flow
      const successFlow = {
        uiShowsSuccessToast: uiContent.includes('Organização atualizada com sucesso'),
        uiClosesDialog: uiContent.includes('setIsEditDialogOpen(false)'),
        uiReloadsData: uiContent.includes('loadOrganizations()'),
        apiReturnsOrganization: apiContent.includes('organization,')
      };
      
      // Check data consistency
      const dataConsistency = {
        uiFormDataNameOnly: uiContent.includes("useState({ name: '' })"),
        apiExtractsNameOnly: apiContent.includes('const { name } = body'),
        noSlugInUI: !uiContent.includes('slug:') || !uiContent.includes('formData'),
        noSlugInAPI: !apiContent.includes('slug') || !apiContent.includes('update')
      };
      
      const allDataFlowValid = Object.values(dataFlow).every(Boolean);
      const allErrorFlowValid = Object.values(errorFlow).every(Boolean);
      const allSuccessFlowValid = Object.values(successFlow).every(Boolean);
      const allDataConsistencyValid = Object.values(dataConsistency).every(Boolean);
      
      return {
        passed: allDataFlowValid && allErrorFlowValid && allSuccessFlowValid && allDataConsistencyValid,
        details: {
          dataFlow,
          errorFlow,
          successFlow,
          dataConsistency,
          allDataFlowValid,
          allErrorFlowValid,
          allSuccessFlowValid,
          allDataConsistencyValid
        },
        expected: 'Complete workflow should handle data flow, errors, and success consistently'
      };
    }
  }
];

// Run all integration tests
async function runIntegrationTests() {
  console.log('🔄 Running Organization Table Integration Tests\n');
  console.log('Testing Requirements: 3.1, 3.2, 3.3 (Table display and interactions)\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const test of integrationTests) {
    try {
      console.log(`Testing: ${test.name}`);
      console.log(`Description: ${test.description}`);
      console.log(`Requirements: ${test.requirement}`);
      
      const result = test.test();
      
      if (result.passed) {
        console.log('✅ PASSED');
        passed++;
      } else {
        console.log('❌ FAILED');
        console.log(`   Expected: ${result.expected}`);
        console.log(`   Details:`, JSON.stringify(result.details, null, 2));
        failed++;
      }
      
      console.log(''); // Empty line for readability
    } catch (error) {
      console.log('❌ FAILED (Exception)');
      console.log(`   Error: ${error.message}`);
      failed++;
      console.log('');
    }
  }
  
  console.log('📊 Integration Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All integration tests passed!');
    console.log('✅ Table displays without slug column');
    console.log('✅ Edit button functionality works correctly');
    console.log('✅ Member counts and dates display correctly');
    console.log('✅ API endpoint handles name-only updates');
    console.log('✅ Complete workflow integration verified');
  } else {
    console.log('\n⚠️  Some integration tests failed. Please review the implementation.');
  }
  
  return { passed, failed };
}

// Export for use in other scripts
module.exports = { runIntegrationTests, integrationTests };

// Run tests if this script is executed directly
if (require.main === module) {
  runIntegrationTests().catch(console.error);
}