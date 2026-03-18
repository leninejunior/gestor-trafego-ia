/**
 * Organization Table Display and Interactions Test Suite
 * 
 * This script tests the table display and interaction functionality
 * Run with: node src/tests/organization-table-display-tests.js
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const ORGANIZATIONS_PAGE_PATH = path.join(__dirname, '../app/admin/organizations/page.tsx');

// Helper function to read file content
function readFileContent(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error.message}`);
  }
}

// Test cases for table display verification
const displayTests = [
  {
    name: 'Table header structure',
    description: 'Verify table headers do not include slug column',
    test: () => {
      const content = readFileContent(ORGANIZATIONS_PAGE_PATH);
      
      // Check that table headers exist
      const hasTableHeaders = content.includes('<TableHeader>') && content.includes('<TableHead>');
      
      // Check that slug column is NOT present
      const hasSlugColumn = content.includes('Slug') || content.includes('slug');
      
      // Check that required columns are present
      const hasNameColumn = content.includes('Nome');
      const hasMembersColumn = content.includes('Membros');
      const hasCreatedColumn = content.includes('Criado em');
      const hasActionsColumn = content.includes('Ações');
      
      return {
        passed: hasTableHeaders && !hasSlugColumn && hasNameColumn && hasMembersColumn && hasCreatedColumn && hasActionsColumn,
        details: {
          hasTableHeaders,
          hasSlugColumn: !hasSlugColumn, // Inverted because we want it to be false
          hasNameColumn,
          hasMembersColumn,
          hasCreatedColumn,
          hasActionsColumn
        },
        expected: 'Table should have Name, Members, Created, Actions columns but NO slug column'
      };
    }
  },
  
  {
    name: 'Table row structure',
    description: 'Verify table rows do not display slug data',
    test: () => {
      const content = readFileContent(ORGANIZATIONS_PAGE_PATH);
      
      // Check that organization mapping exists
      const hasOrgMapping = content.includes('organizations.map');
      
      // Check that slug display is NOT present
      const hasSlugDisplay = content.includes('org.slug') || content.includes('Badge');
      
      // Check that required data displays are present
      const hasNameDisplay = content.includes('org.name');
      const hasMembersDisplay = content.includes('getMembersCount');
      const hasDateDisplay = content.includes('org.created_at');
      
      return {
        passed: hasOrgMapping && !hasSlugDisplay && hasNameDisplay && hasMembersDisplay && hasDateDisplay,
        details: {
          hasOrgMapping,
          hasSlugDisplay: !hasSlugDisplay, // Inverted because we want it to be false
          hasNameDisplay,
          hasMembersDisplay,
          hasDateDisplay
        },
        expected: 'Table rows should display name, member count, date but NO slug or badge'
      };
    }
  },
  
  {
    name: 'Edit button functionality',
    description: 'Verify edit button exists and calls correct function',
    test: () => {
      const content = readFileContent(ORGANIZATIONS_PAGE_PATH);
      
      // Check that edit button exists
      const hasEditButton = content.includes('<Edit className="w-4 h-4" />');
      
      // Check that edit function is called
      const hasEditFunction = content.includes('openEditDialog');
      
      // Check that edit dialog exists
      const hasEditDialog = content.includes('isEditDialogOpen');
      
      return {
        passed: hasEditButton && hasEditFunction && hasEditDialog,
        details: {
          hasEditButton,
          hasEditFunction,
          hasEditDialog
        },
        expected: 'Edit button should exist and trigger openEditDialog function'
      };
    }
  },
  
  {
    name: 'Member count display',
    description: 'Verify member count is displayed correctly',
    test: () => {
      const content = readFileContent(ORGANIZATIONS_PAGE_PATH);
      
      // Check that member count function exists
      const hasMemberCountFunction = content.includes('getMembersCount');
      
      // Check that Users icon is used
      const hasUsersIcon = content.includes('<Users className="w-4 h-4');
      
      // Check that member count is displayed in table
      const hasMemberCountDisplay = content.includes('getMembersCount(org)');
      
      return {
        passed: hasMemberCountFunction && hasUsersIcon && hasMemberCountDisplay,
        details: {
          hasMemberCountFunction,
          hasUsersIcon,
          hasMemberCountDisplay
        },
        expected: 'Member count should be calculated and displayed with Users icon'
      };
    }
  },
  
  {
    name: 'Date formatting',
    description: 'Verify creation date is formatted correctly',
    test: () => {
      const content = readFileContent(ORGANIZATIONS_PAGE_PATH);
      
      // Check that date formatting exists
      const hasDateFormatting = content.includes('toLocaleDateString');
      
      // Check that Brazilian locale is used
      const hasBrazilianLocale = content.includes("'pt-BR'");
      
      // Check that created_at field is used
      const hasCreatedAtField = content.includes('org.created_at');
      
      return {
        passed: hasDateFormatting && hasBrazilianLocale && hasCreatedAtField,
        details: {
          hasDateFormatting,
          hasBrazilianLocale,
          hasCreatedAtField
        },
        expected: 'Date should be formatted using Brazilian locale'
      };
    }
  },
  
  {
    name: 'Organization interface structure',
    description: 'Verify Organization interface does not include slug',
    test: () => {
      const content = readFileContent(ORGANIZATIONS_PAGE_PATH);
      
      // Check that Organization interface exists
      const hasOrgInterface = content.includes('interface Organization');
      
      // Extract interface definition
      const interfaceMatch = content.match(/interface Organization\s*{([^}]+)}/);
      
      if (!interfaceMatch) {
        return {
          passed: false,
          details: { hasOrgInterface: false },
          expected: 'Organization interface should exist'
        };
      }
      
      const interfaceContent = interfaceMatch[1];
      
      // Check that slug is NOT in interface
      const hasSlugProperty = interfaceContent.includes('slug');
      
      // Check that required properties exist
      const hasIdProperty = interfaceContent.includes('id:');
      const hasNameProperty = interfaceContent.includes('name:');
      const hasCreatedAtProperty = interfaceContent.includes('created_at:');
      const hasMembershipsProperty = interfaceContent.includes('memberships:');
      
      return {
        passed: hasOrgInterface && !hasSlugProperty && hasIdProperty && hasNameProperty && hasCreatedAtProperty && hasMembershipsProperty,
        details: {
          hasOrgInterface,
          hasSlugProperty: !hasSlugProperty, // Inverted because we want it to be false
          hasIdProperty,
          hasNameProperty,
          hasCreatedAtProperty,
          hasMembershipsProperty
        },
        expected: 'Organization interface should have id, name, created_at, memberships but NO slug'
      };
    }
  },
  
  {
    name: 'Form data interface structure',
    description: 'Verify FormData interface only includes name field',
    test: () => {
      const content = readFileContent(ORGANIZATIONS_PAGE_PATH);
      
      // Check for FormData interface or formData state
      const hasFormDataState = content.includes("formData, setFormData] = useState({ name: '' })");
      
      // Check that slug is not in form data
      const hasSlugInFormData = content.includes('slug:') && content.includes('formData');
      
      return {
        passed: hasFormDataState && !hasSlugInFormData,
        details: {
          hasFormDataState,
          hasSlugInFormData: !hasSlugInFormData // Inverted because we want it to be false
        },
        expected: 'FormData should only contain name field, no slug'
      };
    }
  }
];

// Test cases for interaction verification
const interactionTests = [
  {
    name: 'Edit dialog form structure',
    description: 'Verify edit dialog only has name input field',
    test: () => {
      const content = readFileContent(ORGANIZATIONS_PAGE_PATH);
      
      // Check that edit dialog exists
      const hasEditDialog = content.includes('Dialog open={isEditDialogOpen}');
      
      // Check that only name input exists in edit dialog
      const hasNameInput = content.includes('id="edit-name"');
      
      // Check that slug input does NOT exist
      const hasSlugInput = content.includes('slug') && content.includes('Input');
      
      // Check that form submission calls handleEdit
      const hasEditSubmission = content.includes('onClick={handleEdit}');
      
      return {
        passed: hasEditDialog && hasNameInput && !hasSlugInput && hasEditSubmission,
        details: {
          hasEditDialog,
          hasNameInput,
          hasSlugInput: !hasSlugInput, // Inverted because we want it to be false
          hasEditSubmission
        },
        expected: 'Edit dialog should have name input only and call handleEdit on submit'
      };
    }
  },
  
  {
    name: 'Edit function implementation',
    description: 'Verify handleEdit function only sends name field',
    test: () => {
      const content = readFileContent(ORGANIZATIONS_PAGE_PATH);
      
      // Check that handleEdit function exists
      const hasHandleEdit = content.includes('const handleEdit = async');
      
      // Check that only formData is sent (which should only contain name)
      const sendsFormData = content.includes('body: JSON.stringify(formData)');
      
      // Check that success message is shown
      const hasSuccessMessage = content.includes('Organização atualizada com sucesso');
      
      return {
        passed: hasHandleEdit && sendsFormData && hasSuccessMessage,
        details: {
          hasHandleEdit,
          sendsFormData,
          hasSuccessMessage
        },
        expected: 'handleEdit should send formData and show success message'
      };
    }
  },
  
  {
    name: 'Error handling implementation',
    description: 'Verify proper error handling in edit function',
    test: () => {
      const content = readFileContent(ORGANIZATIONS_PAGE_PATH);
      
      // Check that error handling exists
      const hasTryCatch = content.includes('try {') && content.includes('} catch (error: any) {');
      
      // Check that error toast is shown
      const hasErrorToast = content.includes("variant: 'destructive'");
      
      // Check that error message is extracted
      const hasErrorExtraction = content.includes('error.message');
      
      return {
        passed: hasTryCatch && hasErrorToast && hasErrorExtraction,
        details: {
          hasTryCatch,
          hasErrorToast,
          hasErrorExtraction
        },
        expected: 'Error handling should use try-catch and show error toast'
      };
    }
  }
];

// Run all tests
async function runTests() {
  console.log('🧪 Running Organization Table Display and Interactions Tests\n');
  
  let passed = 0;
  let failed = 0;
  
  console.log('📋 Display Tests:');
  console.log('================\n');
  
  for (const test of displayTests) {
    try {
      console.log(`Testing: ${test.name}`);
      console.log(`Description: ${test.description}`);
      
      const result = test.test();
      
      if (result.passed) {
        console.log('✅ PASSED');
        passed++;
      } else {
        console.log('❌ FAILED');
        console.log(`   Expected: ${result.expected}`);
        console.log(`   Details:`, result.details);
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
  
  console.log('🔄 Interaction Tests:');
  console.log('====================\n');
  
  for (const test of interactionTests) {
    try {
      console.log(`Testing: ${test.name}`);
      console.log(`Description: ${test.description}`);
      
      const result = test.test();
      
      if (result.passed) {
        console.log('✅ PASSED');
        passed++;
      } else {
        console.log('❌ FAILED');
        console.log(`   Expected: ${result.expected}`);
        console.log(`   Details:`, result.details);
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
  
  console.log('📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All table display and interaction tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the implementation.');
  }
  
  return { passed, failed };
}

// Export for use in other scripts
module.exports = { runTests, displayTests, interactionTests };

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}