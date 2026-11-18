<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Form;
use App\Models\FormCategory;
use App\Models\Location;
use App\Models\NotificationSetting;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\ScoringSetting;
use App\Models\User;
use App\Support\RolePermissions;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class FmsSeeder extends Seeder
{
    public function run(): void
    {
        foreach (array_keys(RolePermissions::catalog()) as $permission) {
            Permission::findOrCreate($permission);
        }

        $owner = Role::findOrCreate('owner');
        $superadmin = Role::findOrCreate('superadmin');
        $admin = Role::findOrCreate('admin');
        $staff = Role::findOrCreate('staff');

        $owner->syncPermissions(RolePermissions::defaults('owner'));
        $superadmin->syncPermissions(RolePermissions::defaults('superadmin'));
        $admin->syncPermissions(RolePermissions::defaults('admin'));
        $staff->syncPermissions(RolePermissions::defaults('staff'));

        $starter = Plan::query()->updateOrCreate(
            ['slug' => 'starter'],
            [
                'name' => 'Starter',
                'description' => 'Small businesses getting started with feedback',
                'price_monthly' => 29,
                'branch_limit' => 3,
                'location_limit' => 50,
                'features' => ['forms', 'cases', 'qr', 'basic_reports'],
                'is_active' => true,
                'sort_order' => 1,
            ]
        );
        Plan::query()->updateOrCreate(
            ['slug' => 'growth'],
            [
                'name' => 'Growth',
                'description' => 'Multi-branch organizations',
                'price_monthly' => 79,
                'branch_limit' => 10,
                'location_limit' => 300,
                'features' => ['forms', 'cases', 'qr', 'reports', 'custom_domain'],
                'is_active' => true,
                'sort_order' => 2,
            ]
        );
        Plan::query()->updateOrCreate(
            ['slug' => 'enterprise'],
            [
                'name' => 'Enterprise',
                'description' => 'Large chains with advanced limits',
                'price_monthly' => 199,
                'branch_limit' => 100,
                'location_limit' => null,
                'features' => ['forms', 'cases', 'qr', 'reports', 'custom_domain', 'priority_support'],
                'is_active' => true,
                'sort_order' => 3,
            ]
        );

        if (app()->isProduction()) {
            $this->seedProductionOwner();

            return;
        }

        $ownerUser = User::query()->updateOrCreate(
            ['email' => 'owner@fms.test'],
            [
                'name' => 'Platform Owner',
                'password' => Hash::make('password'),
                'is_active' => true,
            ]
        );
        $ownerUser->syncRoles(['owner']);

        $org = Organization::query()->updateOrCreate(
            ['slug' => 'demo-hotel'],
            [
                'plan_id' => $starter->id,
                'name' => 'Demo Hotel',
                'primary_color' => '#1A3352',
                'secondary_color' => '#D99212',
                'branch_limit' => $starter->branch_limit,
                'plan_expires_at' => now()->addYear(),
                'status' => 'active',
                'welcome_text' => 'How was your stay with us?',
                'thank_you_text' => 'Thank you! Your feedback helps us improve.',
                'privacy_note' => 'We only use your details to follow up if needed.',
                'allow_anonymous' => false,
                'language' => 'en',
            ]
        );

        ScoringSetting::query()->updateOrCreate(
            ['organization_id' => $org->id],
            ScoringSetting::defaults()
        );

        NotificationSetting::query()->updateOrCreate(
            ['organization_id' => $org->id],
            [
                'email_on_flagged' => true,
                'notify_emails' => ['superadmin@demohotel.test'],
                'whatsapp_enabled' => false,
            ]
        );

        $branch = Branch::query()->updateOrCreate(
            ['organization_id' => $org->id, 'slug' => 'downtown'],
            [
                'name' => 'Downtown',
                'address' => '123 Main Street',
                'city' => 'Karachi',
                'is_active' => true,
            ]
        );

        $superadminUser = User::query()->updateOrCreate(
            ['email' => 'superadmin@demohotel.test'],
            [
                'organization_id' => $org->id,
                'branch_id' => null,
                'name' => 'Hotel Superadmin',
                'password' => Hash::make('password'),
                'is_active' => true,
            ]
        );
        $superadminUser->syncRoles(['superadmin']);

        $adminUser = User::query()->updateOrCreate(
            ['email' => 'admin@demohotel.test'],
            [
                'organization_id' => $org->id,
                'branch_id' => $branch->id,
                'name' => 'Branch Admin',
                'password' => Hash::make('password'),
                'is_active' => true,
            ]
        );
        $adminUser->syncRoles(['admin']);

        $staffUser = User::query()->updateOrCreate(
            ['email' => 'staff@demohotel.test'],
            [
                'organization_id' => $org->id,
                'branch_id' => $branch->id,
                'name' => 'Branch Staff',
                'password' => Hash::make('password'),
                'is_active' => true,
            ]
        );
        $staffUser->syncRoles(['staff']);

        $form = Form::query()->updateOrCreate(
            ['organization_id' => $org->id, 'name' => 'Hotel Stay Feedback'],
            [
                'branch_id' => null,
                'is_active' => true,
            ]
        );

        foreach ([
            ['name' => 'Room 101', 'slug' => 'room-101', 'type' => 'room'],
            ['name' => 'Room 102', 'slug' => 'room-102', 'type' => 'room'],
            ['name' => 'Lobby Counter', 'slug' => 'lobby', 'type' => 'counter'],
        ] as $loc) {
            Location::query()->updateOrCreate(
                ['branch_id' => $branch->id, 'slug' => $loc['slug']],
                [
                    'organization_id' => $org->id,
                    'form_id' => $form->id,
                    'name' => $loc['name'],
                    'type' => $loc['type'],
                    'is_active' => true,
                ]
            );
        }

        // Reset template content for idempotent seeding
        $form->questions()->delete();
        $form->categories()->delete();

        $categories = [
            'Room' => FormCategory::query()->create([
                'organization_id' => $org->id,
                'form_id' => $form->id,
                'name' => 'Room',
                'sort_order' => 1,
            ]),
            'Cleanliness' => FormCategory::query()->create([
                'organization_id' => $org->id,
                'form_id' => $form->id,
                'name' => 'Cleanliness',
                'sort_order' => 2,
            ]),
            'Staff' => FormCategory::query()->create([
                'organization_id' => $org->id,
                'form_id' => $form->id,
                'name' => 'Staff',
                'sort_order' => 3,
            ]),
            'Service' => FormCategory::query()->create([
                'organization_id' => $org->id,
                'form_id' => $form->id,
                'name' => 'Service',
                'sort_order' => 4,
            ]),
        ];

        $choiceOptions = [
            ['label' => 'Excellent', 'score_value' => 100],
            ['label' => 'Good', 'score_value' => 75],
            ['label' => 'Average', 'score_value' => 50],
            ['label' => 'Poor', 'score_value' => 25],
            ['label' => 'Bad', 'score_value' => 0],
        ];

        $questionDefs = [
            ['text' => 'How would you rate your room?', 'type' => 'single_choice', 'category' => 'Room', 'weight' => 1.5, 'critical' => true],
            ['text' => 'Cleanliness of the room', 'type' => 'single_choice', 'category' => 'Cleanliness', 'weight' => 1.5, 'critical' => true],
            ['text' => 'Staff friendliness', 'type' => 'star', 'category' => 'Staff', 'weight' => 1, 'critical' => false],
            ['text' => 'Overall service quality', 'type' => 'nps', 'category' => 'Service', 'weight' => 1, 'critical' => false],
            ['text' => 'Would you stay with us again?', 'type' => 'yes_no', 'category' => 'Service', 'weight' => 1, 'critical' => false],
            ['text' => 'Any additional comments?', 'type' => 'text', 'category' => 'Service', 'weight' => 0, 'critical' => false],
        ];

        foreach ($questionDefs as $index => $def) {
            $question = Question::query()->create([
                'organization_id' => $org->id,
                'form_id' => $form->id,
                'form_category_id' => $categories[$def['category']]->id,
                'text' => $def['text'],
                'type' => $def['type'],
                'is_required' => $def['type'] !== 'text',
                'sort_order' => $index + 1,
                'weight' => $def['weight'],
                'is_critical' => $def['critical'],
                'follow_up_on_low' => $def['critical'],
                'low_score_threshold' => 40,
                'is_active' => true,
            ]);

            if ($def['type'] === 'single_choice') {
                foreach ($choiceOptions as $optIndex => $option) {
                    QuestionOption::query()->create([
                        'question_id' => $question->id,
                        'label' => $option['label'],
                        'score_value' => $option['score_value'],
                        'sort_order' => $optIndex,
                    ]);
                }
            }
        }
    }

    /**
     * Production gets the roles, permissions and plans plus one Owner account, and none of the demo data.
     * The password comes from FMS_OWNER_PASSWORD, or is generated once and shown in the console.
     * An Owner that already exists is left untouched, so re-running the seeder never resets it.
     */
    private function seedProductionOwner(): void
    {
        $owner = User::query()->firstOrNew(['email' => env('FMS_OWNER_EMAIL') ?: 'owner@fms.test']);

        if ($owner->exists) {
            return;
        }

        $password = env('FMS_OWNER_PASSWORD') ?: Str::password(20, symbols: false);

        $owner->fill(['name' => 'Platform Owner', 'password' => $password, 'is_active' => true])->save();
        $owner->syncRoles(['owner']);

        $this->command?->warn('Owner account created: '.$owner->email);

        if (! env('FMS_OWNER_PASSWORD')) {
            $this->command?->warn('Generated password (shown once, change it after signing in): '.$password);
        }
    }
}
