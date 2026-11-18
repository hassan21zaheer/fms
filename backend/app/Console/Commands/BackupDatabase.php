<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;

class BackupDatabase extends Command
{
    /**
     * Tables whose rows are temporary or secret, so a backup carries only their structure.
     *
     * @var array<int, string>
     */
    private const TRANSIENT_TABLES = [
        'personal_access_tokens',
        'sessions',
        'cache',
        'cache_locks',
        'jobs',
        'job_batches',
        'failed_jobs',
        'password_reset_tokens',
    ];

    protected $signature = 'fms:backup-database {--keep=14 : How many backup files to keep}';

    protected $description = 'Save a full copy of the MySQL database into database/backups inside the project';

    public function handle(): int
    {
        $connection = config('database.connections.'.config('database.default'));

        if (($connection['driver'] ?? null) !== 'mysql') {
            $this->error('Backups are only set up for MySQL.');

            return self::FAILURE;
        }

        $dumpBinary = $this->findDumpBinary();
        if (! $dumpBinary) {
            $this->error('mysqldump was not found. Set DB_DUMP_PATH in .env to its full path.');

            return self::FAILURE;
        }

        $directory = database_path('backups');
        File::ensureDirectoryExists($directory);
        $file = $directory.DIRECTORY_SEPARATOR.'fms-'.now()->format('Y-m-d_His').'.sql';

        $base = [
            $dumpBinary,
            '--host='.$connection['host'],
            '--port='.$connection['port'],
            '--user='.$connection['username'],
            '--single-transaction',
            '--no-tablespaces',
        ];
        $environment = ['MYSQL_PWD' => (string) ($connection['password'] ?? '')];

        $ignored = array_map(fn (string $table) => '--ignore-table='.$connection['database'].'.'.$table, self::TRANSIENT_TABLES);

        $process = new Process([...$base, '--routines', ...$ignored, '--result-file='.$file, $connection['database']], null, $environment);
        $process->setTimeout(600);
        $process->run();

        $structureOnly = new Process([...$base, '--no-data', $connection['database'], ...self::TRANSIENT_TABLES], null, $environment);
        $structureOnly->setTimeout(600);
        $structureOnly->run();

        if (! $process->isSuccessful() || ! $structureOnly->isSuccessful() || ! is_file($file) || filesize($file) === 0) {
            File::delete($file);
            $this->error('The backup failed: '.trim($process->getErrorOutput().$structureOnly->getErrorOutput()));

            return self::FAILURE;
        }

        File::append($file, "\n-- Login tokens, sessions, cache and queued jobs are kept as empty tables on purpose.\n".$structureOnly->getOutput());

        $this->info('Backup saved: '.$file.' ('.number_format(filesize($file) / 1024).' KB)');
        $this->prune($directory, max(1, (int) $this->option('keep')));

        return self::SUCCESS;
    }

    private function findDumpBinary(): ?string
    {
        $configured = env('DB_DUMP_PATH');
        if ($configured && is_file($configured)) {
            return $configured;
        }

        $found = glob('D:\\laragon\\bin\\mysql\\*\\bin\\mysqldump.exe') ?: [];

        if ($found !== []) {
            return $found[0];
        }

        return (new Process(['mysqldump', '--version']))->setTimeout(10)->run() === 0 ? 'mysqldump' : null;
    }

    private function prune(string $directory, int $keep): void
    {
        $files = collect(File::glob($directory.DIRECTORY_SEPARATOR.'fms-*.sql'))->sortDesc()->values();

        $files->slice($keep)->each(function (string $old): void {
            File::delete($old);
            $this->line('Removed old backup: '.basename($old));
        });
    }
}
