
                    -- Rename org_id to organization_id in subscriptions table
                    ALTER TABLE subscriptions 
                    RENAME COLUMN org_id TO organization_id;
                    
                    -- Update the foreign key constraint if it exists
                    DO $$ 
                    BEGIN
                        -- Drop old constraint if it exists
                        IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
                                  WHERE constraint_name LIKE '%org_id%' 
                                  AND table_name = 'subscriptions') THEN
                            ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_org_id_fkey;
                        END IF;
                        
                        -- Add new constraint
                        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                                      WHERE constraint_name = 'subscriptions_organization_id_fkey' 
                                      AND table_name = 'subscriptions') THEN
                            ALTER TABLE subscriptions 
                            ADD CONSTRAINT subscriptions_organization_id_fkey 
                            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
                        END IF;
                    END $$;
                    
                    -- Ensure the plan_id foreign key exists
                    DO $$ 
                    BEGIN
                        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                                      WHERE constraint_name = 'subscriptions_plan_id_fkey' 
                                      AND table_name = 'subscriptions') THEN
                            ALTER TABLE subscriptions 
                            ADD CONSTRAINT subscriptions_plan_id_fkey 
                            FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE RESTRICT;
                        END IF;
                    END $$;
                    
                    -- Update table statistics
                    ANALYZE subscriptions;
                    ANALYZE subscription_plans;
                    ANALYZE organizations;
                