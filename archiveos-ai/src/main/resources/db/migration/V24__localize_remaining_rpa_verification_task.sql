do $$
begin
  if to_regclass('public.archiveos_rpa_tasks') is not null then
    update public.archiveos_rpa_tasks
    set title = 'ArchiveOS 자동화 안전 검증',
        description = '통제된 RPA 분류 흐름을 확인하는 기록 전용 검증입니다. 외부 실행, 배포, shell, 데이터베이스 또는 정산 작업은 수행하지 않습니다.'
    where id = '871790d9-c456-489f-9c3a-736d49ad9a00'::uuid
      and title = 'ArchiveOS automation verification'
      and description = 'Controlled RPA classification verification. Record only; no external execution, deployment, shell, database, or settlement action.';
  end if;
end $$;
